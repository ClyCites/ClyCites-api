import jwt from "jsonwebtoken"
import ApiToken from "../models/apiTokenModel.js"
import User from "../models/userModel.js"
import { asyncHandler } from "../utils/asyncHandler.js"
import { AppError } from "../utils/appError.js"
import { validationResult } from "express-validator"
import crypto from "crypto"

// Helper function to extract token from request (prioritize API tokens)
const extractTokenFromRequest = (req) => {
  let token

  // First, check for API token in x-api-key header (highest priority for API tokens)
  if (req.headers["x-api-key"]) {
    token = req.headers["x-api-key"]
  }

  // Second, check request body for API token
  if (!token && req.body.token && req.body.token.startsWith("clycites_")) {
    token = req.body.token
  }

  // Third, check Authorization header (could be JWT or API token)
  if (!token && req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1]
  }

  // Fourth, check request body for any token (fallback)
  if (!token && req.body.token) {
    token = req.body.token
  }

  // Fifth, check query parameters
  if (!token && req.query.token) {
    token = req.query.token
  }

  // Sixth, check cookies
  if (!token && req.cookies.token) {
    token = req.cookies.token
  }

  return token
}

// @desc    Validate any token (public endpoint)
// @route   POST /api/auth/validate-token
// @access  Public
export const validateToken = asyncHandler(async (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return next(new AppError("Validation failed", 400, errors.array()))
  }

  const token = extractTokenFromRequest(req)

  if (!token) {
    return next(new AppError("Token is required for validation", 400))
  }

  try {
    console.log("=== Public Token Validation ===")
    console.log("Token type:", token.startsWith("clycites_") ? "API Token" : "JWT Token")
    console.log("Request IP:", req.ip)

    // Validate based on token type
    if (token.startsWith("clycites_")) {
      const result = await validateAPITokenLogic(token, req)
      return res.status(200).json({
        success: true,
        message: "API token validated successfully",
        data: {
          ...result,
          tokenType: "api_token",
          validatedAt: new Date().toISOString(),
        },
      })
    } else {
      const result = await validateJWTTokenLogic(token)
      return res.status(200).json({
        success: true,
        message: "JWT token validated successfully",
        data: {
          ...result,
          tokenType: "jwt",
          validatedAt: new Date().toISOString(),
        },
      })
    }
  } catch (error) {
    console.error("Token validation error:", error)
    return res.status(401).json({
      success: false,
      message: error.message || "Token validation failed",
      error: "VALIDATION_ERROR",
    })
  }
})

// @desc    Quick token validation (public endpoint)
// @route   POST /api/auth/validate-token/quick
// @access  Public
export const quickValidateToken = asyncHandler(async (req, res, next) => {
  const token = extractTokenFromRequest(req)

  if (!token) {
    return next(new AppError("Token is required for validation", 400))
  }

  try {
    if (token.startsWith("clycites_")) {
      // Quick API token validation
      const hashedToken = crypto.createHash("sha256").update(token).digest("hex")

      const apiToken = await ApiToken.findOne({
        hashedToken,
        isActive: true,
        expiresAt: { $gt: new Date() },
      }).select("name scopes expiresAt createdAt")

      if (!apiToken) {
        return res.status(401).json({
          success: false,
          message: "Invalid or expired API token",
          isValid: false,
        })
      }

      return res.status(200).json({
        success: true,
        message: "API token is valid",
        isValid: true,
        data: {
          tokenId: apiToken._id,
          name: apiToken.name,
          scopes: apiToken.scopes,
          expiresAt: apiToken.expiresAt,
          issuedAt: apiToken.createdAt,
        },
      })
    } else {
      // Quick JWT validation
      const decoded = jwt.verify(token, process.env.JWT_SECRET)

      return res.status(200).json({
        success: true,
        message: "JWT token is valid",
        isValid: true,
        data: {
          userId: decoded.id,
          expiresAt: new Date(decoded.exp * 1000),
          issuedAt: new Date(decoded.iat * 1000),
        },
      })
    }
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: error.name === "TokenExpiredError" ? "Token expired" : "Invalid token",
      isValid: false,
      error: error.name,
    })
  }
})

// @desc    Validate token with specific scopes (API token auth)
// @route   POST /api/auth/validate-token/scopes
// @access  Private (requires API token)
export const validateTokenWithScopes = asyncHandler(async (req, res, next) => {
  const { scopes } = req.body

  if (!scopes || !Array.isArray(scopes)) {
    return next(new AppError("Scopes array is required", 400))
  }

  // API token is already validated and attached to req.apiToken by authenticateApiToken middleware
  const apiToken = req.apiToken

  // Check if token has all required scopes
  const missingScopes = scopes.filter((scope) => !apiToken.scopes.includes(scope))

  if (missingScopes.length > 0) {
    return next(new AppError(`Token missing required scopes: ${missingScopes.join(", ")}`, 403))
  }

  return res.status(200).json({
    success: true,
    message: "Token has required scopes",
    data: {
      tokenId: apiToken._id,
      name: apiToken.name,
      scopes: apiToken.scopes,
      requiredScopes: scopes,
      hasAllScopes: true,
    },
  })
})

// @desc    Validate token for resource permissions (API token auth)
// @route   POST /api/auth/validate-token/resource
// @access  Private (requires API token)
export const validateTokenForResource = asyncHandler(async (req, res, next) => {
  const { resource, actions } = req.body

  if (!resource || !actions || !Array.isArray(actions)) {
    return next(new AppError("Resource and actions array are required", 400))
  }

  // API token is already validated and attached to req.apiToken by authenticateApiToken middleware
  const apiToken = req.apiToken

  // Check permissions
  const permission = apiToken.permissions.find((p) => p.resource === resource)
  const missingActions = actions.filter((action) => !permission || !permission.actions.includes(action))

  if (missingActions.length > 0) {
    return next(new AppError(`Token missing required permissions: ${resource}:${missingActions.join(", ")}`, 403))
  }

  return res.status(200).json({
    success: true,
    message: "Token has required permissions",
    data: {
      tokenId: apiToken._id,
      name: apiToken.name,
      resource,
      actions,
      hasAllPermissions: true,
    },
  })
})

// Helper function for API token validation logic
const validateAPITokenLogic = async (token, req = null) => {
  if (!token.startsWith("clycites_") || token.length !== 73) {
    throw new Error("Invalid API token format")
  }

  const hashedToken = crypto.createHash("sha256").update(token).digest("hex")

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
    throw new Error("Invalid or expired API token")
  }

  if (!apiToken.organization.isActive) {
    throw new Error("Organization is inactive")
  }

  if (!apiToken.user.isActive) {
    throw new Error("User account is inactive")
  }

  // Update usage if request provided
  if (req) {
    apiToken.usage.totalRequests += 1
    apiToken.usage.lastUsedAt = new Date()
    apiToken.usage.lastUsedIP = req.ip
    apiToken.usage.lastUsedUserAgent = req.get("user-agent")
    await apiToken.save()
  }

  return {
    user: {
      id: apiToken.user._id,
      name: `${apiToken.user.firstName} ${apiToken.user.lastName}`,
      email: apiToken.user.email,
      username: apiToken.user.username,
    },
    organization: {
      id: apiToken.organization._id,
      name: apiToken.organization.name,
      slug: apiToken.organization.slug,
    },
    application: apiToken.application
      ? {
          id: apiToken.application._id,
          name: apiToken.application.name,
          type: apiToken.application.type,
        }
      : null,
    apiToken: {
      id: apiToken._id,
      name: apiToken.name,
      scopes: apiToken.scopes,
      permissions: apiToken.permissions,
      expiresAt: apiToken.expiresAt,
    },
  }
}

// Helper function for JWT token validation logic
const validateJWTTokenLogic = async (token) => {
  const decoded = jwt.verify(token, process.env.JWT_SECRET)

  const user = await User.findById(decoded.id).select("-password")

  if (!user) {
    throw new Error("User not found")
  }

  if (!user.isActive) {
    throw new Error("User account is inactive")
  }

  return {
    user: {
      id: user._id,
      name: `${user.firstName} ${user.lastName}`,
      email: user.email,
      username: user.username,
    },
    expiresAt: new Date(decoded.exp * 1000),
    issuedAt: new Date(decoded.iat * 1000),
  }
}

// @desc    Get token info (API token auth)
// @route   GET /api/auth/token-info
// @access  Private (requires API token)
export const getTokenInfo = asyncHandler(async (req, res) => {
  // API token is already validated and attached to req.apiToken by authenticateApiToken middleware
  const apiToken = req.apiToken

  res.status(200).json({
    success: true,
    data: {
      tokenInfo: {
        type: "api_token",
        id: apiToken._id,
        name: apiToken.name,
        scopes: apiToken.scopes,
        permissions: apiToken.permissions,
        expiresAt: apiToken.expiresAt,
        createdAt: apiToken.createdAt,
        isActive: apiToken.isActive,
      },
      user: {
        id: apiToken.user._id,
        name: `${apiToken.user.firstName} ${apiToken.user.lastName}`,
        email: apiToken.user.email,
        username: apiToken.user.username,
      },
      organization: {
        id: apiToken.organization._id,
        name: apiToken.organization.name,
        slug: apiToken.organization.slug,
      },
      usage: apiToken.usage,
    },
  })
})

// @desc    Check token health (API token auth)
// @route   GET /api/auth/token-health
// @access  Private (requires API token)
export const checkTokenHealth = asyncHandler(async (req, res) => {
  const apiToken = req.apiToken

  const now = new Date()
  const daysUntilExpiry = Math.ceil((apiToken.expiresAt - now) / (1000 * 60 * 60 * 24))

  res.status(200).json({
    success: true,
    data: {
      tokenId: apiToken._id,
      name: apiToken.name,
      health: {
        status: daysUntilExpiry > 30 ? "healthy" : daysUntilExpiry > 7 ? "warning" : "critical",
        daysUntilExpiry,
        expiresAt: apiToken.expiresAt,
      },
      usage: {
        totalRequests: apiToken.usage.totalRequests,
        lastUsedAt: apiToken.usage.lastUsedAt,
      },
    },
  })
})

// @desc    Get token usage stats (API token auth with admin scope)
// @route   GET /api/auth/token-usage
// @access  Private (requires API token with admin scope)
export const getTokenUsageStats = asyncHandler(async (req, res) => {
  const apiToken = req.apiToken
  const organizationId = apiToken.organization

  const tokens = await ApiToken.find({ organization: organizationId }).select("name usage expiresAt isActive")

  const summary = {
    totalTokens: tokens.length,
    activeTokens: tokens.filter((t) => t.isActive && t.expiresAt > new Date()).length,
    totalRequests: tokens.reduce((sum, token) => sum + token.usage.totalRequests, 0),
  }

  res.status(200).json({
    success: true,
    data: { summary },
  })
})

export default {
  validateToken,
  quickValidateToken,
  validateTokenWithScopes,
  validateTokenForResource,
  getTokenInfo,
  checkTokenHealth,
  getTokenUsageStats,
}
