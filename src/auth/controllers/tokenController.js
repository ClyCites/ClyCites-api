import { asyncHandler } from "../utils/asyncHandler.js"
import { AppError } from "../utils/appError.js"
import ApiToken from "../models/apiTokenModel.js"
import User from "../models/userModel.js"
import jwt from "jsonwebtoken"
import crypto from "crypto"

// Helper function to extract token from request
const extractToken = (req) => {
  // Check header
  const apiKey = req.headers["x-api-key"] || req.headers["authorization"]

  // Check body
  const bodyToken = req.body.token

  // Check query
  const queryToken = req.query.token

  return apiKey || bodyToken || queryToken
}

// Helper function to get allowed scopes based on role level (matching your controller)
const getScopesForRoleLevel = (roleLevel) => {
  const baseScopes = ["profile", "read"]

  if (roleLevel >= 50) {
    // Member+
    baseScopes.push("email", "teams")
  }

  if (roleLevel >= 70) {
    // Manager+
    baseScopes.push("users", "write", "invite")
  }

  if (roleLevel >= 85) {
    // Admin+
    baseScopes.push("organizations", "roles", "applications", "delete", "manage")
  }

  if (roleLevel >= 90) {
    // Owner+
    baseScopes.push("permissions", "billing", "admin")
  }

  if (roleLevel >= 95) {
    // Platform Admin+
    baseScopes.push("analytics", "export", "import")
  }

  return baseScopes
}

// Helper function to get rate limits based on role level (matching your controller)
const getRateLimitsForRoleLevel = (roleLevel) => {
  if (roleLevel >= 90) {
    // Owner+
    return {
      requestsPerMinute: 1000,
      requestsPerHour: 10000,
      requestsPerDay: 100000,
    }
  }

  if (roleLevel >= 70) {
    // Manager+
    return {
      requestsPerMinute: 500,
      requestsPerHour: 5000,
      requestsPerDay: 50000,
    }
  }

  if (roleLevel >= 50) {
    // Member+
    return {
      requestsPerMinute: 100,
      requestsPerHour: 1000,
      requestsPerDay: 10000,
    }
  }

  // Default for lower roles
  return {
    requestsPerMinute: 60,
    requestsPerHour: 500,
    requestsPerDay: 5000,
  }
}

// @desc    Validate token (full validation with user data)
// @route   POST /api/auth/validate-token
// @access  Public
export const validateToken = asyncHandler(async (req, res, next) => {
  // Extract token from request
  let token = extractToken(req)

  if (!token) {
    return next(new AppError("No token provided", 401))
  }

  // Remove Bearer prefix if present
  if (token.startsWith("Bearer ")) {
    token = token.slice(7)
  }

  try {
    // Check if it's an API token (starts with clycites_)
    if (token.startsWith("clycites_")) {
      // Validate API token
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
        return next(new AppError("Invalid or expired token", 401))
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

      // Return token information
      return res.status(200).json({
        success: true,
        message: "Token is valid",
        data: {
          tokenId: apiToken._id,
          name: apiToken.name,
          type: "api_token",
          scopes: apiToken.scopes,
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
                platform: apiToken.application.platform,
              }
            : null,
          expiresAt: apiToken.expiresAt,
          issuedAt: apiToken.createdAt,
          daysUntilExpiry: apiToken.daysUntilExpiry,
          usage: {
            totalRequests: apiToken.usage.totalRequests,
            lastUsedAt: apiToken.usage.lastUsedAt,
          },
        },
      })
    } else {
      // Assume it's a JWT token
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET)

        // Get user data
        const user = await User.findById(decoded.id).select("-password")

        if (!user) {
          return next(new AppError("User not found", 404))
        }

        if (!user.isActive) {
          return next(new AppError("User account is inactive", 403))
        }

        return res.status(200).json({
          success: true,
          message: "Token is valid",
          data: {
            type: "jwt",
            user: {
              id: user._id,
              name: `${user.firstName} ${user.lastName}`,
              email: user.email,
              username: user.username,
            },
            expiresAt: new Date(decoded.exp * 1000),
            issuedAt: new Date(decoded.iat * 1000),
          },
        })
      } catch (error) {
        return next(new AppError("Invalid or expired JWT token", 401))
      }
    }
  } catch (error) {
    console.error("Token validation error:", error)
    return next(new AppError("Token validation failed", 500))
  }
})

// @desc    Quick token validation (no user lookup)
// @route   POST /api/auth/validate-token/quick
// @access  Public
export const quickValidateToken = asyncHandler(async (req, res, next) => {
  // Extract token from request
  let token = extractToken(req)

  if (!token) {
    return next(new AppError("No token provided", 401))
  }

  // Remove Bearer prefix if present
  if (token.startsWith("Bearer ")) {
    token = token.slice(7)
  }

  try {
    // Check if it's an API token (starts with clycites_)
    if (token.startsWith("clycites_")) {
      // Quick validation - just check if token exists and is active
      const hashedToken = crypto.createHash("sha256").update(token).digest("hex")

      const apiToken = await ApiToken.findOne({
        hashedToken,
        isActive: true,
        expiresAt: { $gt: new Date() },
      }).select("name scopes expiresAt createdAt")

      if (!apiToken) {
        return next(new AppError("Invalid or expired token", 401))
      }

      // Return minimal token information
      return res.status(200).json({
        success: true,
        message: "Token is valid",
        data: {
          tokenId: apiToken._id,
          name: apiToken.name,
          type: "api_token",
          scopes: apiToken.scopes,
          expiresAt: apiToken.expiresAt,
          issuedAt: apiToken.createdAt,
        },
      })
    } else {
      // Assume it's a JWT token
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET)

        return res.status(200).json({
          success: true,
          message: "Token is valid",
          data: {
            type: "jwt",
            userId: decoded.id,
            expiresAt: new Date(decoded.exp * 1000),
            issuedAt: new Date(decoded.iat * 1000),
          },
        })
      } catch (error) {
        return next(new AppError("Invalid or expired JWT token", 401))
      }
    }
  } catch (error) {
    console.error("Quick token validation error:", error)
    return next(new AppError("Token validation failed", 500))
  }
})

// @desc    Get token info (for debugging)
// @route   GET /api/auth/token-info
// @access  Private
export const getTokenInfo = asyncHandler(async (req, res, next) => {
  const { tokenId, token } = req.query

  try {
    let apiToken

    if (tokenId) {
      // Find by ID
      apiToken = await ApiToken.findById(tokenId)
        .select("-hashedToken")
        .populate("user", "firstName lastName email username")
        .populate("organization", "name slug")
        .populate("application", "name type platform")
    } else if (token) {
      // Find by token value
      const hashedToken = crypto.createHash("sha256").update(token).digest("hex")

      apiToken = await ApiToken.findOne({ hashedToken })
        .select("-hashedToken")
        .populate("user", "firstName lastName email username")
        .populate("organization", "name slug")
        .populate("application", "name type platform")
    } else {
      return next(new AppError("Token ID or token value is required", 400))
    }

    if (!apiToken) {
      return next(new AppError("Token not found", 404))
    }

    // Check if user has permission to view this token
    if (apiToken.user._id.toString() !== req.user.id) {
      return next(new AppError("You don't have permission to view this token", 403))
    }

    // Add status information
    const now = new Date()
    const isExpired = apiToken.expiresAt < now
    const daysUntilExpiry = Math.ceil((apiToken.expiresAt - now) / (1000 * 60 * 60 * 24))

    const tokenWithStatus = {
      ...apiToken.toObject(),
      status: {
        isExpired,
        isActive: apiToken.isActive && !isExpired,
        daysUntilExpiry: isExpired ? 0 : daysUntilExpiry,
        expiresIn: isExpired ? "Expired" : `${daysUntilExpiry} days`,
        lastUsed: apiToken.usage.lastUsedAt
          ? `${Math.floor((now - apiToken.usage.lastUsedAt) / (1000 * 60 * 60 * 24))} days ago`
          : "Never",
      },
    }

    res.status(200).json({
      success: true,
      data: {
        token: tokenWithStatus,
      },
    })
  } catch (error) {
    console.error("Error getting token info:", error)
    return next(new AppError("Failed to get token info", 500))
  }
})

// @desc    Validate token with specific required scopes
// @route   POST /api/auth/validate-token/scopes
// @access  Public
export const validateTokenWithScopes = asyncHandler(async (req, res, next) => {
  // Extract token from request
  let token = extractToken(req)
  const { scopes } = req.body

  if (!token) {
    return next(new AppError("No token provided", 401))
  }

  // Remove Bearer prefix if present
  if (token.startsWith("Bearer ")) {
    token = token.slice(7)
  }

  try {
    // Check if it's an API token (starts with clycites_)
    if (token.startsWith("clycites_")) {
      // Validate API token
      const hashedToken = crypto.createHash("sha256").update(token).digest("hex")

      const apiToken = await ApiToken.findOne({
        hashedToken,
        isActive: true,
        expiresAt: { $gt: new Date() },
      })

      if (!apiToken) {
        return next(new AppError("Invalid or expired token", 401))
      }

      // Check if token has all required scopes
      const hasAllScopes = apiToken.hasScopes(scopes)

      if (!hasAllScopes) {
        return next(new AppError(`Token missing required scopes: ${scopes.join(", ")}`, 403))
      }

      // Update usage statistics
      apiToken.usage.totalRequests += 1
      apiToken.usage.lastUsedAt = new Date()
      apiToken.usage.lastUsedIP = req.ip || req.connection.remoteAddress
      apiToken.usage.lastUsedUserAgent = req.get("user-agent") || null

      await apiToken.save()

      // Return token information
      return res.status(200).json({
        success: true,
        message: "Token has required scopes",
        data: {
          tokenId: apiToken._id,
          name: apiToken.name,
          scopes: apiToken.scopes,
          requiredScopes: scopes,
          expiresAt: apiToken.expiresAt,
        },
      })
    } else {
      return next(new AppError("Only API tokens can be validated for scopes", 400))
    }
  } catch (error) {
    console.error("Token scope validation error:", error)
    return next(new AppError("Token scope validation failed", 500))
  }
})

// @desc    Validate token for specific resource and actions
// @route   POST /api/auth/validate-token/resource
// @access  Public
export const validateTokenForResource = asyncHandler(async (req, res, next) => {
  // Extract token from request
  let token = extractToken(req)
  const { resource, actions } = req.body

  if (!token) {
    return next(new AppError("No token provided", 401))
  }

  // Remove Bearer prefix if present
  if (token.startsWith("Bearer ")) {
    token = token.slice(7)
  }

  try {
    // Check if it's an API token (starts with clycites_)
    if (token.startsWith("clycites_")) {
      // Validate API token
      const hashedToken = crypto.createHash("sha256").update(token).digest("hex")

      const apiToken = await ApiToken.findOne({
        hashedToken,
        isActive: true,
        expiresAt: { $gt: new Date() },
      })

      if (!apiToken) {
        return next(new AppError("Invalid or expired token", 401))
      }

      // Check if token has permission for resource and actions
      const missingActions = []

      for (const action of actions) {
        if (!apiToken.hasPermission(resource, action)) {
          missingActions.push(action)
        }
      }

      if (missingActions.length > 0) {
        return next(new AppError(`Token missing required permissions: ${resource}:${missingActions.join(", ")}`, 403))
      }

      // Update usage statistics
      apiToken.usage.totalRequests += 1
      apiToken.usage.lastUsedAt = new Date()
      apiToken.usage.lastUsedIP = req.ip || req.connection.remoteAddress
      apiToken.usage.lastUsedUserAgent = req.get("user-agent") || null

      await apiToken.save()

      // Return token information
      return res.status(200).json({
        success: true,
        message: "Token has required permissions",
        data: {
          tokenId: apiToken._id,
          name: apiToken.name,
          resource,
          actions,
          permissions: apiToken.permissions,
          expiresAt: apiToken.expiresAt,
        },
      })
    } else {
      return next(new AppError("Only API tokens can be validated for resource permissions", 400))
    }
  } catch (error) {
    console.error("Token resource validation error:", error)
    return next(new AppError("Token resource validation failed", 500))
  }
})

// @desc    Check token health and validity
// @route   GET /api/auth/token-health
// @access  Private (requires API token)
export const checkTokenHealth = asyncHandler(async (req, res) => {
  // Token is already validated by authenticateApiToken middleware
  const apiToken = req.apiToken

  // Calculate health metrics
  const now = new Date()
  const totalLifespan = apiToken.expiresAt - apiToken.createdAt
  const elapsed = now - apiToken.createdAt
  const percentageUsed = Math.round((elapsed / totalLifespan) * 100)

  const daysUntilExpiry = Math.ceil((apiToken.expiresAt - now) / (1000 * 60 * 60 * 24))

  res.status(200).json({
    success: true,
    data: {
      tokenId: apiToken._id,
      name: apiToken.name,
      health: {
        status: daysUntilExpiry > 30 ? "healthy" : daysUntilExpiry > 7 ? "warning" : "critical",
        daysUntilExpiry,
        percentageUsed,
        expiresAt: apiToken.expiresAt,
        issuedAt: apiToken.createdAt,
      },
      usage: {
        totalRequests: apiToken.usage.totalRequests,
        lastUsedAt: apiToken.usage.lastUsedAt,
      },
      scopes: apiToken.scopes,
    },
  })
})

// @desc    Get token usage statistics
// @route   GET /api/auth/token-usage
// @access  Private (requires API token with admin scope)
export const getTokenUsageStats = asyncHandler(async (req, res) => {
  // Token is already validated by authenticateApiToken middleware
  const apiToken = req.apiToken

  // Get organization ID from token
  const organizationId = apiToken.organization

  // Get usage statistics for all tokens in the organization
  const tokens = await ApiToken.find({ organization: organizationId })
    .select("name usage expiresAt isActive createdAt")
    .sort({ "usage.totalRequests": -1 })

  // Calculate summary statistics
  const totalRequests = tokens.reduce((sum, token) => sum + token.usage.totalRequests, 0)
  const activeTokens = tokens.filter((t) => t.isActive && t.expiresAt > new Date()).length
  const expiredTokens = tokens.filter((t) => t.expiresAt <= new Date()).length
  const inactiveTokens = tokens.filter((t) => !t.isActive).length

  // Get top 10 most used tokens
  const topTokens = tokens
    .sort((a, b) => b.usage.totalRequests - a.usage.totalRequests)
    .slice(0, 10)
    .map((token) => ({
      id: token._id,
      name: token.name,
      totalRequests: token.usage.totalRequests,
      lastUsedAt: token.usage.lastUsedAt,
      isActive: token.isActive && token.expiresAt > new Date(),
    }))

  res.status(200).json({
    success: true,
    data: {
      summary: {
        totalTokens: tokens.length,
        activeTokens,
        expiredTokens,
        inactiveTokens,
        totalRequests,
      },
      topTokens,
    },
  })
})

export default {
  validateToken,
  quickValidateToken,
  getTokenInfo,
  validateTokenWithScopes,
  validateTokenForResource,
  checkTokenHealth,
  getTokenUsageStats,
}
