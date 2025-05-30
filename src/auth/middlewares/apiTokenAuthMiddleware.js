import ApiToken from "../models/apiTokenModel.js"
import { AppError } from "../utils/appError.js"
import crypto from "crypto"

// Middleware to authenticate API tokens (matching your token creation logic)
export const authenticateApiToken = async (req, res, next) => {
  try {
    let token

    // Extract token from headers
    if (req.headers["x-api-key"]) {
      token = req.headers["x-api-key"]
    } else if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
      const authToken = req.headers.authorization.split(" ")[1]
      if (authToken.startsWith("clycites_")) {
        token = authToken
      }
    }

    if (!token) {
      return next(new AppError("API token is required", 401))
    }

    // Validate token format (matching your creation logic)
    if (!token.startsWith("clycites_") || token.length !== 73) {
      return next(new AppError("Invalid API token format", 401))
    }

    // Hash token to find in database
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex")

    // Find and validate token
    const apiToken = await ApiToken.findOne({
      hashedToken,
      isActive: true,
      expiresAt: { $gt: new Date() },
    })
      .populate("user", "firstName lastName email username isActive isLocked")
      .populate("organization", "name slug isActive")

    if (!apiToken) {
      return next(new AppError("Invalid or expired API token", 401))
    }

    // Check if user and organization are active
    if (!apiToken.user.isActive) {
      return next(new AppError("User account is inactive", 401))
    }

    if (apiToken.user.isLocked) {
      return next(new AppError("User account is locked", 401))
    }

    if (!apiToken.organization.isActive) {
      return next(new AppError("Organization is inactive", 401))
    }

    // Check IP restrictions
    if (apiToken.restrictions.allowedIPs.length > 0) {
      const clientIP = req.ip || req.connection.remoteAddress
      if (!apiToken.restrictions.allowedIPs.includes(clientIP)) {
        return next(new AppError("Access denied from this IP address", 403))
      }
    }

    // Update usage statistics
    apiToken.usage.totalRequests += 1
    apiToken.usage.lastUsedAt = new Date()
    apiToken.usage.lastUsedIP = req.ip || req.connection.remoteAddress
    apiToken.usage.lastUsedUserAgent = req.headers["user-agent"] || null
    await apiToken.save()

    // Attach token and user info to request
    req.apiToken = apiToken
    req.user = apiToken.user
    req.organization = apiToken.organization

    next()
  } catch (error) {
    console.error("API token authentication error:", error)
    return next(new AppError("Token authentication failed", 401))
  }
}

// Middleware to check specific scopes
export const requireScopes = (requiredScopes) => {
  return (req, res, next) => {
    if (!req.apiToken) {
      return next(new AppError("API token required for scope validation", 401))
    }

    const hasRequiredScopes = requiredScopes.every((scope) => req.apiToken.scopes.includes(scope))

    if (!hasRequiredScopes) {
      return next(
        new AppError(
          `Insufficient scopes. Required: ${requiredScopes.join(", ")}. Available: ${req.apiToken.scopes.join(", ")}`,
          403,
        ),
      )
    }

    next()
  }
}

// Middleware to check specific permissions
export const requirePermissions = (resource, actions) => {
  return (req, res, next) => {
    if (!req.apiToken) {
      return next(new AppError("API token required for permission validation", 401))
    }

    const hasPermission = req.apiToken.permissions.some((permission) => {
      return permission.resource === resource && actions.every((action) => permission.actions.includes(action))
    })

    if (!hasPermission) {
      return next(new AppError(`Insufficient permissions for ${resource}:${actions.join(",")}`, 403))
    }

    next()
  }
}

export default {
  authenticateApiToken,
  requireScopes,
  requirePermissions,
}
