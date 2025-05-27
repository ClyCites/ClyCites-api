import ApiToken from "../models/apiTokenModel.js"
import Application from "../models/applicationModel.js"
import { asyncHandler } from "../utils/asyncHandler.js"
import { AppError } from "../utils/appError.js"

// Middleware to authenticate API tokens
export const authenticateApiToken = asyncHandler(async (req, res, next) => {
  let token

  // Check for token in headers
  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1]
  }

  // Check for API key in headers
  if (!token && req.headers["x-api-key"]) {
    token = req.headers["x-api-key"]
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
