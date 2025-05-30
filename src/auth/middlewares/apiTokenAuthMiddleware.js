import { asyncHandler } from "../utils/asyncHandler.js"
import { AppError } from "../utils/appError.js"
import ApiToken from "../models/apiTokenModel.js"
import crypto from "crypto"

// Middleware to authenticate API token
export const authenticateApiToken = asyncHandler(async (req, res, next) => {
  // Get token from header
  let token = req.headers["x-api-key"] || req.headers["authorization"]

  // Check if token exists
  if (!token) {
    return next(new AppError("API token is required", 401))
  }

  // Remove Bearer prefix if present
  if (token.startsWith("Bearer ")) {
    token = token.slice(7)
  }

  // Check if it's an API token (starts with clycites_)
  if (!token.startsWith("clycites_")) {
    return next(new AppError("Invalid API token format", 401))
  }

  try {
    // Hash the token
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex")

    // Find the token in the database
    const apiToken = await ApiToken.findOne({
      hashedToken,
      isActive: true,
      expiresAt: { $gt: new Date() },
    }).populate([
      { path: "user", select: "firstName lastName email username isActive" },
      { path: "organization", select: "name slug isActive" },
      { path: "application", select: "name type platform" },
    ])

    if (!apiToken) {
      return next(new AppError("Invalid or expired API token", 401))
    }

    // Check if organization is active
    if (!apiToken.organization.isActive) {
      return next(new AppError("Organization is inactive", 403))
    }

    // Check if user is active
    if (!apiToken.user.isActive) {
      return next(new AppError("User account is inactive", 403))
    }

    // Check IP restrictions if configured
    if (apiToken.restrictions?.allowedIPs?.length > 0) {
      const clientIP = req.ip || req.connection.remoteAddress
      if (!apiToken.isIPAllowed(clientIP)) {
        return next(new AppError("Access denied from this IP address", 403))
      }
    }

    // Check domain restrictions if configured
    if (apiToken.restrictions?.allowedDomains?.length > 0) {
      const origin = req.get("origin") || req.get("referer")
      if (origin && !apiToken.isDomainAllowed(new URL(origin).hostname)) {
        return next(new AppError("Access denied from this domain", 403))
      }
    }

    // Update usage statistics
    apiToken.usage.totalRequests += 1
    apiToken.usage.lastUsedAt = new Date()
    apiToken.usage.lastUsedIP = req.ip || req.connection.remoteAddress
    apiToken.usage.lastUsedUserAgent = req.get("user-agent") || null

    await apiToken.save()

    // Attach token and user to request
    req.apiToken = apiToken
    req.user = apiToken.user
    req.organization = apiToken.organization

    next()
  } catch (error) {
    console.error("API token authentication error:", error)
    return next(new AppError("Authentication failed", 500))
  }
})

// Middleware to require specific scopes
export const requireScopes = (requiredScopes) => {
  return asyncHandler(async (req, res, next) => {
    // Check if API token exists on request
    if (!req.apiToken) {
      return next(new AppError("API token authentication required", 401))
    }

    // Check if token has all required scopes
    const hasAllScopes = requiredScopes.every((scope) => req.apiToken.scopes.includes(scope))

    if (!hasAllScopes) {
      return next(new AppError(`Insufficient scopes. Required: ${requiredScopes.join(", ")}`, 403))
    }

    next()
  })
}

// Middleware to require permission for resource and action
export const requirePermission = (resource, action) => {
  return asyncHandler(async (req, res, next) => {
    // Check if API token exists on request
    if (!req.apiToken) {
      return next(new AppError("API token authentication required", 401))
    }

    // Check if token has permission for resource and action
    const hasPermission = req.apiToken.hasPermission(resource, action)

    if (!hasPermission) {
      return next(new AppError(`Insufficient permissions. Required: ${resource}:${action}`, 403))
    }

    next()
  })
}

export default {
  authenticateApiToken,
  requireScopes,
  requirePermission,
}
