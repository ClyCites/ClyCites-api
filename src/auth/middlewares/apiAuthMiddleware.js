import ApiToken from "../models/apiTokenModel.js"
import Application from "../models/applicationModel.js"
import { asyncHandler } from "../utils/asyncHandler.js"
import { AppError } from "../utils/appError.js"

// Middleware to authenticate API tokens
export const authenticateApiToken = asyncHandler(async (req, res, next) => {
  let token

  // Check for token in headers (multiple formats)
  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1]
  }

  // Check for API key in headers
  if (!token && req.headers["x-api-key"]) {
    token = req.headers["x-api-key"]
  }

  // Check for API key in query params (less secure, but sometimes needed)
  if (!token && req.query.api_key) {
    token = req.query.api_key
  }

  if (!token) {
    return next(new AppError("API token required", 401))
  }

  try {
    // Verify API token
    const apiToken = await ApiToken.verifyToken(token)

    if (!apiToken) {
      return next(new AppError("Invalid or expired API token", 401))
    }

    // Check if organization is active
    if (!apiToken.organization.isActive) {
      return next(new AppError("Organization is inactive", 401))
    }

    // Check if user is active
    if (!apiToken.user.isActive) {
      return next(new AppError("User account is inactive", 401))
    }

    // Update last used information
    apiToken.usage.lastUsedAt = new Date()
    apiToken.usage.lastUsedIP = req.ip
    apiToken.usage.lastUsedUserAgent = req.get("User-Agent")
    await apiToken.save()

    // Attach token info to request
    req.apiToken = apiToken
    req.user = apiToken.user
    req.organization = apiToken.organization

    next()
  } catch (error) {
    return next(new AppError("API token verification failed", 401))
  }
})

// Middleware to check API token scopes
export const requireScope = (...requiredScopes) => {
  return (req, res, next) => {
    if (!req.apiToken) {
      return next(new AppError("API token required", 401))
    }

    const hasRequiredScope = requiredScopes.some((scope) => req.apiToken.hasScope(scope))

    if (!hasRequiredScope) {
      return next(new AppError(`Insufficient scope. Required: ${requiredScopes.join(" or ")}`, 403))
    }

    next()
  }
}

// Middleware to check API token permissions
export const requirePermission = (resource, action) => {
  return (req, res, next) => {
    if (!req.apiToken) {
      return next(new AppError("API token required", 401))
    }

    if (!req.apiToken.hasPermission(resource, action)) {
      return next(new AppError(`Insufficient permissions for ${action} on ${resource}`, 403))
    }

    next()
  }
}

// OAuth2 client authentication
export const authenticateClient = asyncHandler(async (req, res, next) => {
  const { client_id, client_secret } = req.body

  if (!client_id || !client_secret) {
    return next(new AppError("Client credentials required", 401))
  }

  const application = await Application.findOne({ clientId: client_id }).select("+clientSecret")

  if (!application || !application.verifySecret(client_secret)) {
    return next(new AppError("Invalid client credentials", 401))
  }

  if (!application.isActive) {
    return next(new AppError("Application is inactive", 401))
  }

  req.client = application
  next()
})

// Middleware to check rate limits for API tokens
export const checkApiTokenRateLimit = asyncHandler(async (req, res, next) => {
  if (!req.apiToken) {
    return next()
  }

  const now = new Date()
  const limits = req.apiToken.rateLimits

  // Simple in-memory rate limiting (in production, use Redis)
  if (!req.apiToken.usage.rateLimitCounters) {
    req.apiToken.usage.rateLimitCounters = {
      minute: { count: 0, resetTime: now.getTime() + 60000 },
      hour: { count: 0, resetTime: now.getTime() + 3600000 },
      day: { count: 0, resetTime: now.getTime() + 86400000 },
    }
  }

  const counters = req.apiToken.usage.rateLimitCounters

  // Reset counters if time window has passed
  if (now.getTime() > counters.minute.resetTime) {
    counters.minute = { count: 0, resetTime: now.getTime() + 60000 }
  }
  if (now.getTime() > counters.hour.resetTime) {
    counters.hour = { count: 0, resetTime: now.getTime() + 3600000 }
  }
  if (now.getTime() > counters.day.resetTime) {
    counters.day = { count: 0, resetTime: now.getTime() + 86400000 }
  }

  // Check limits
  if (counters.minute.count >= limits.requestsPerMinute) {
    return next(new AppError("Rate limit exceeded: too many requests per minute", 429))
  }
  if (counters.hour.count >= limits.requestsPerHour) {
    return next(new AppError("Rate limit exceeded: too many requests per hour", 429))
  }
  if (counters.day.count >= limits.requestsPerDay) {
    return next(new AppError("Rate limit exceeded: too many requests per day", 429))
  }

  // Increment counters
  counters.minute.count++
  counters.hour.count++
  counters.day.count++

  // Add rate limit headers
  res.set({
    "X-RateLimit-Limit-Minute": limits.requestsPerMinute,
    "X-RateLimit-Remaining-Minute": limits.requestsPerMinute - counters.minute.count,
    "X-RateLimit-Reset-Minute": new Date(counters.minute.resetTime).toISOString(),
    "X-RateLimit-Limit-Hour": limits.requestsPerHour,
    "X-RateLimit-Remaining-Hour": limits.requestsPerHour - counters.hour.count,
    "X-RateLimit-Reset-Hour": new Date(counters.hour.resetTime).toISOString(),
  })

  next()
})

export default {
  authenticateApiToken,
  requireScope,
  requirePermission,
  authenticateClient,
  checkApiTokenRateLimit,
}
