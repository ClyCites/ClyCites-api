import jwt from "jsonwebtoken"
import ApiToken from "../models/apiTokenModel.js"
import User from "../models/userModel.js"
import OrganizationMember from "../models/organizationMemberModel.js"
import { asyncHandler } from "../utils/asyncHandler.js"
import { AppError } from "../utils/appError.js"
import { validationResult } from "express-validator"
import crypto from "crypto"

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

// @desc    Validate API token or JWT token (comprehensive validation)
// @route   POST /api/auth/validate-token
// @access  Public (but requires valid token)
export const validateToken = asyncHandler(async (req, res, next) => {
  // Check for validation errors from express-validator
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return next(new AppError("Validation failed", 400, errors.array()))
  }

  let token
  let tokenType = "unknown"

  // Extract token from multiple sources (same as authMiddleware)
  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1]
  }

  if (!token && req.headers["x-api-key"]) {
    token = req.headers["x-api-key"]
  }

  if (!token && req.body.token) {
    token = req.body.token
  }

  if (!token && req.cookies.token) {
    token = req.cookies.token
  }

  if (!token) {
    return next(new AppError("Token is required for validation", 400))
  }

  try {
    // Log request details for debugging
    console.log("=== Token Validation Request ===")
    console.log("Token prefix:", token.substring(0, 15) + "...")
    console.log("Request IP:", req.ip)
    console.log("User Agent:", req.headers["user-agent"])
    console.log("Origin:", req.headers.origin)

    // Check if it's an API token first (they start with 'clycites_')
    if (token.startsWith("clycites_")) {
      const validationResult = await validateAPIToken(token, req)
      if (validationResult.success) {
        tokenType = "api_token"
        return res.status(200).json({
          success: true,
          message: "API token validated successfully",
          data: {
            ...validationResult.data,
            tokenType,
            validatedAt: new Date().toISOString(),
            isValid: true,
            requestInfo: {
              ip: req.ip,
              userAgent: req.headers["user-agent"],
              origin: req.headers.origin,
              timestamp: new Date().toISOString(),
            },
          },
        })
      } else {
        return res.status(401).json({
          success: false,
          message: validationResult.message,
          error: validationResult.error,
          tokenType: "api_token",
          requestInfo: {
            ip: req.ip,
            userAgent: req.headers["user-agent"],
            timestamp: new Date().toISOString(),
          },
        })
      }
    }

    // Try JWT validation
    const validationResult = await validateJWTToken(token)
    if (validationResult.success) {
      tokenType = "jwt"
      return res.status(200).json({
        success: true,
        message: "JWT token validated successfully",
        data: {
          ...validationResult.data,
          tokenType,
          validatedAt: new Date().toISOString(),
          isValid: true,
          requestInfo: {
            ip: req.ip,
            userAgent: req.headers["user-agent"],
            timestamp: new Date().toISOString(),
          },
        },
      })
    }

    // If both fail, return error
    return res.status(401).json({
      success: false,
      message: validationResult.message || "Invalid token",
      error: validationResult.error || "TOKEN_VALIDATION_FAILED",
      tokenType: tokenType,
      requestInfo: {
        ip: req.ip,
        userAgent: req.headers["user-agent"],
        timestamp: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error("Token validation error:", error)
    return res.status(401).json({
      success: false,
      message: "Token validation failed",
      error: "VALIDATION_ERROR",
      details: error.message,
      requestInfo: {
        ip: req.ip,
        userAgent: req.headers["user-agent"],
        timestamp: new Date().toISOString(),
      },
    })
  }
})

// @desc    Validate API token (matching your token creation logic)
const validateAPIToken = async (token, req = null) => {
  try {
    // Validate token format (must start with 'clycites_' and be proper length)
    if (!token || typeof token !== "string") {
      return {
        success: false,
        message: "Invalid token format",
        error: "INVALID_TOKEN_FORMAT",
      }
    }

    if (!token.startsWith("clycites_")) {
      return {
        success: false,
        message: "Invalid token prefix",
        error: "INVALID_TOKEN_PREFIX",
      }
    }

    // Token should be clycites_ + 64 hex chars = 73 total chars
    if (token.length !== 73) {
      return {
        success: false,
        message: "Invalid token length",
        error: "INVALID_TOKEN_LENGTH",
      }
    }

    // Create hash to find token in database (matching your creation logic)
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex")

    // Find token in database with all necessary population
    const apiToken = await ApiToken.findOne({
      hashedToken,
      isActive: true,
      expiresAt: { $gt: new Date() },
    })
      .populate({
        path: "user",
        select:
          "firstName lastName email username isActive isLocked globalRole profilePicture isEmailVerified lastLogin",
      })
      .populate({
        path: "organization",
        select: "name slug description isActive subscription industry size",
      })
      .populate({
        path: "application",
        select: "name type platform isActive",
      })

    if (!apiToken) {
      return {
        success: false,
        message: "Token not found, expired, or inactive",
        error: "TOKEN_NOT_FOUND",
      }
    }

    // Check if organization is active
    if (!apiToken.organization || !apiToken.organization.isActive) {
      return {
        success: false,
        message: "Organization is inactive",
        error: "ORGANIZATION_INACTIVE",
      }
    }

    // Check if user is active
    if (!apiToken.user || !apiToken.user.isActive) {
      return {
        success: false,
        message: "User account is inactive",
        error: "USER_INACTIVE",
      }
    }

    // Check if user account is locked
    if (apiToken.user.isLocked) {
      return {
        success: false,
        message: "User account is locked",
        error: "USER_LOCKED",
      }
    }

    // Check IP restrictions if configured
    if (
      req &&
      apiToken.restrictions &&
      apiToken.restrictions.allowedIPs &&
      apiToken.restrictions.allowedIPs.length > 0
    ) {
      const clientIP = req.ip || req.connection.remoteAddress || req.socket.remoteAddress
      if (!apiToken.restrictions.allowedIPs.includes(clientIP)) {
        return {
          success: false,
          message: "Access denied from this IP address",
          error: "IP_RESTRICTED",
          clientIP,
          allowedIPs: apiToken.restrictions.allowedIPs,
        }
      }
    }

    // Check domain restrictions if configured
    if (
      req &&
      apiToken.restrictions &&
      apiToken.restrictions.allowedDomains &&
      apiToken.restrictions.allowedDomains.length > 0
    ) {
      const origin = req.headers.origin || req.headers.referer
      if (origin) {
        try {
          const domain = new URL(origin).hostname
          if (!apiToken.restrictions.allowedDomains.includes(domain)) {
            return {
              success: false,
              message: "Access denied from this domain",
              error: "DOMAIN_RESTRICTED",
              domain,
              allowedDomains: apiToken.restrictions.allowedDomains,
            }
          }
        } catch (e) {
          console.error("Error parsing origin:", e)
        }
      }
    }

    // Check User-Agent restrictions if configured
    if (
      req &&
      apiToken.restrictions &&
      apiToken.restrictions.allowedUserAgents &&
      apiToken.restrictions.allowedUserAgents.length > 0
    ) {
      const userAgent = req.headers["user-agent"]
      if (userAgent) {
        const isAllowed = apiToken.restrictions.allowedUserAgents.some((allowedUA) =>
          userAgent.toLowerCase().includes(allowedUA.toLowerCase()),
        )
        if (!isAllowed) {
          return {
            success: false,
            message: "Access denied from this user agent",
            error: "USER_AGENT_RESTRICTED",
            userAgent,
            allowedUserAgents: apiToken.restrictions.allowedUserAgents,
          }
        }
      }
    }

    // Get user's role in the organization for scope validation
    const membership = await OrganizationMember.findOne({
      user: apiToken.user._id,
      organization: apiToken.organization._id,
      status: "active",
    }).populate("role")

    let userRoleLevel = 0
    if (membership && membership.role) {
      userRoleLevel = membership.role.level
    }

    // Get allowed scopes for user's role level
    const allowedScopes = getScopesForRoleLevel(userRoleLevel)
    const maxRateLimits = getRateLimitsForRoleLevel(userRoleLevel)

    // Update usage statistics if request object is provided
    if (req) {
      apiToken.usage.totalRequests += 1
      apiToken.usage.lastUsedAt = new Date()
      apiToken.usage.lastUsedIP = req.ip || req.connection.remoteAddress
      apiToken.usage.lastUsedUserAgent = req.headers["user-agent"] || null
      await apiToken.save()
    }

    return {
      success: true,
      data: {
        user: {
          id: apiToken.user._id,
          username: apiToken.user.username,
          email: apiToken.user.email,
          firstName: apiToken.user.firstName,
          lastName: apiToken.user.lastName,
          fullName: `${apiToken.user.firstName} ${apiToken.user.lastName}`.trim(),
          globalRole: apiToken.user.globalRole,
          profilePicture: apiToken.user.profilePicture,
          isEmailVerified: apiToken.user.isEmailVerified,
          lastLogin: apiToken.user.lastLogin,
          isActive: apiToken.user.isActive,
        },
        organization: {
          id: apiToken.organization._id,
          name: apiToken.organization.name,
          slug: apiToken.organization.slug,
          description: apiToken.organization.description,
          isActive: apiToken.organization.isActive,
          subscription: apiToken.organization.subscription,
          industry: apiToken.organization.industry,
          size: apiToken.organization.size,
        },
        application: apiToken.application
          ? {
              id: apiToken.application._id,
              name: apiToken.application.name,
              type: apiToken.application.type,
              platform: apiToken.application.platform,
              isActive: apiToken.application.isActive,
            }
          : null,
        apiToken: {
          id: apiToken._id,
          name: apiToken.name,
          description: apiToken.description,
          scopes: apiToken.scopes,
          permissions: apiToken.permissions,
          rateLimits: apiToken.rateLimits,
          expiresAt: apiToken.expiresAt,
          isActive: apiToken.isActive,
          createdAt: apiToken.createdAt,
          updatedAt: apiToken.updatedAt,
        },
        membership: membership
          ? {
              role: {
                id: membership.role._id,
                name: membership.role.name,
                slug: membership.role.slug,
                level: membership.role.level,
                permissions: membership.role.permissions,
              },
              status: membership.status,
              joinedAt: membership.joinedAt,
            }
          : null,
        tokenInfo: {
          type: "api_token",
          createdAt: apiToken.createdAt,
          expiresAt: apiToken.expiresAt,
          lastUsedAt: apiToken.usage.lastUsedAt,
          totalRequests: apiToken.usage.totalRequests,
          isExpired: apiToken.expiresAt < new Date(),
          daysUntilExpiry: Math.ceil((apiToken.expiresAt - new Date()) / (1000 * 60 * 60 * 24)),
        },
        validation: {
          allowedScopes,
          maxRateLimits,
          userRoleLevel,
          hasValidScopes: apiToken.scopes.every((scope) => allowedScopes.includes(scope)),
          restrictions: {
            hasIPRestrictions: apiToken.restrictions.allowedIPs.length > 0,
            hasDomainRestrictions: apiToken.restrictions.allowedDomains.length > 0,
            hasUserAgentRestrictions: apiToken.restrictions.allowedUserAgents.length > 0,
          },
        },
      },
    }
  } catch (error) {
    console.error("API token validation error:", error)
    return {
      success: false,
      message: "API token validation failed",
      error: "API_TOKEN_VALIDATION_FAILED",
      details: error.message,
    }
  }
}

// @desc    Validate JWT token (exact same logic as authMiddleware.protect)
const validateJWTToken = async (token) => {
  try {
    // Verify token using the same secret as login
    const decoded = jwt.verify(token, process.env.JWT_SECRET)

    // Get user from token (same as authMiddleware)
    const user = await User.findById(decoded.id)

    if (!user) {
      return {
        success: false,
        message: "The user belonging to this token no longer exists",
        error: "USER_NOT_FOUND",
      }
    }

    // Check if user is active (same checks as authMiddleware)
    if (!user.isActive) {
      return {
        success: false,
        message: "Your account has been deactivated. Please contact support.",
        error: "ACCOUNT_DEACTIVATED",
      }
    }

    // Check if account is locked (same checks as authMiddleware)
    if (user.isLocked) {
      return {
        success: false,
        message: "Account temporarily locked due to too many failed login attempts",
        error: "ACCOUNT_LOCKED",
      }
    }

    // Get user's organization memberships
    const organizationMemberships = await getUserOrganizations(user._id)

    // Return user data in the same format as login response
    return {
      success: true,
      data: {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          fullName: user.fullName,
          role: user.globalRole, // Global role for backward compatibility
          globalRole: user.globalRole,
          profilePicture: user.profilePicture,
          isEmailVerified: user.isEmailVerified,
          lastLogin: user.lastLogin,
          isActive: user.isActive,
          createdAt: user.createdAt,
        },
        organizations: organizationMemberships,
        // Include primary organization (first one or default)
        primaryOrganization: organizationMemberships.length > 0 ? organizationMemberships[0] : null,
        tokenInfo: {
          type: "jwt",
          issuedAt: new Date(decoded.iat * 1000),
          expiresAt: new Date(decoded.exp * 1000),
          userId: decoded.id,
          isExpired: decoded.exp < Date.now() / 1000,
          timeToExpiry: decoded.exp - Math.floor(Date.now() / 1000),
        },
      },
    }
  } catch (error) {
    console.error("JWT validation error:", error)

    // Provide specific error messages
    if (error.name === "JsonWebTokenError") {
      return {
        success: false,
        message: "Invalid token",
        error: "INVALID_JWT",
      }
    } else if (error.name === "TokenExpiredError") {
      return {
        success: false,
        message: "Token expired",
        error: "TOKEN_EXPIRED",
        expiredAt: new Date(error.expiredAt).toISOString(),
      }
    } else {
      return {
        success: false,
        message: "Token verification failed",
        error: "JWT_VERIFICATION_FAILED",
        details: error.message,
      }
    }
  }
}

// Helper function to get user organizations (same as used in other controllers)
const getUserOrganizations = async (userId) => {
  try {
    const memberships = await OrganizationMember.find({
      user: userId,
      status: "active",
    })
      .populate({
        path: "organization",
        select: "name slug description isActive subscription industry size",
      })
      .populate({
        path: "role",
        select: "name slug level permissions isSystem",
      })
      .sort({ joinedAt: 1 }) // Oldest membership first (likely primary org)

    return memberships.map((membership) => ({
      organization: {
        id: membership.organization._id,
        name: membership.organization.name,
        slug: membership.organization.slug,
        description: membership.organization.description,
        isActive: membership.organization.isActive,
        subscription: membership.organization.subscription,
        industry: membership.organization.industry,
        size: membership.organization.size,
      },
      role: {
        id: membership.role._id,
        name: membership.role.name,
        slug: membership.role.slug,
        level: membership.role.level,
        permissions: membership.role.permissions,
        isSystem: membership.role.isSystem,
      },
      membership: {
        status: membership.status,
        joinedAt: membership.joinedAt,
        lastActivity: membership.lastActivity,
      },
    }))
  } catch (error) {
    console.error("Error fetching user organizations:", error)
    return []
  }
}

// @desc    Get token information (for debugging)
// @route   GET /api/auth/token-info
// @access  Private
export const getTokenInfo = asyncHandler(async (req, res, next) => {
  let token

  // Extract token (same sources as validation)
  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1]
  }

  if (!token && req.headers["x-api-key"]) {
    token = req.headers["x-api-key"]
  }

  if (!token && req.cookies.token) {
    token = req.cookies.token
  }

  if (!token) {
    return next(new AppError("Token is required", 400))
  }

  // Try to decode JWT without verification to get info
  let tokenInfo = {}

  try {
    const decoded = jwt.decode(token, { complete: true })
    if (decoded) {
      tokenInfo = {
        type: "jwt",
        header: decoded.header,
        payload: {
          ...decoded.payload,
          iat: new Date(decoded.payload.iat * 1000).toISOString(),
          exp: new Date(decoded.payload.exp * 1000).toISOString(),
          isExpired: decoded.payload.exp < Date.now() / 1000,
          timeToExpiry: decoded.payload.exp - Math.floor(Date.now() / 1000),
        },
        rawToken: token.substring(0, 15) + "...",
      }
    }
  } catch (error) {
    // Not a JWT, might be API token
    try {
      if (token.startsWith("clycites_")) {
        const hashedToken = crypto.createHash("sha256").update(token).digest("hex")

        const apiToken = await ApiToken.findOne({ hashedToken })
          .populate("user", "username email")
          .populate("organization", "name slug")

        if (apiToken) {
          tokenInfo = {
            type: "api_token",
            name: apiToken.name,
            user: apiToken.user.username,
            organization: apiToken.organization.name,
            scopes: apiToken.scopes,
            createdAt: apiToken.createdAt,
            expiresAt: apiToken.expiresAt,
            isActive: apiToken.isActive,
            isExpired: apiToken.expiresAt < new Date(),
            rawToken: token.substring(0, 15) + "...",
            format: "clycites_[64_hex_chars]",
            length: token.length,
            expectedLength: 73,
          }
        } else {
          tokenInfo = {
            type: "api_token",
            message: "API token not found in database",
            rawToken: token.substring(0, 15) + "...",
            format: "clycites_[64_hex_chars]",
            length: token.length,
            expectedLength: 73,
          }
        }
      } else {
        tokenInfo = {
          type: "unknown",
          message: "Token format not recognized",
          rawToken: token.substring(0, 15) + "...",
          expectedFormats: ["JWT", "clycites_[64_hex_chars]"],
        }
      }
    } catch (apiError) {
      tokenInfo = {
        type: "error",
        message: "Failed to analyze token",
        error: apiError.message,
        rawToken: token.substring(0, 15) + "...",
      }
    }
  }

  res.status(200).json({
    success: true,
    data: {
      tokenInfo,
      environment: {
        jwtSecretConfigured: !!process.env.JWT_SECRET,
        nodeEnv: process.env.NODE_ENV,
      },
      requestInfo: {
        ip: req.ip,
        userAgent: req.headers["user-agent"],
        origin: req.headers.origin,
        timestamp: new Date().toISOString(),
      },
    },
  })
})

// @desc    Quick token validation (lightweight version)
// @route   POST /api/auth/validate-token/quick
// @access  Public
export const quickValidateToken = asyncHandler(async (req, res, next) => {
  let token

  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1]
  }

  if (!token && req.headers["x-api-key"]) {
    token = req.headers["x-api-key"]
  }

  if (!token && req.body.token) {
    token = req.body.token
  }

  if (!token) {
    return res.status(400).json({
      success: false,
      message: "Token is required",
      isValid: false,
    })
  }

  try {
    // Check if it's an API token
    if (token.startsWith("clycites_")) {
      // Validate token format first
      if (token.length !== 73) {
        return res.status(401).json({
          success: false,
          message: "Invalid API token format",
          isValid: false,
          tokenType: "api_token",
          details: `Expected length 73, got ${token.length}`,
        })
      }

      // For quick validation, we don't need to update usage stats
      const hashedToken = crypto.createHash("sha256").update(token).digest("hex")

      const apiToken = await ApiToken.findOne({
        hashedToken,
        isActive: true,
        expiresAt: { $gt: new Date() },
      }).select("name expiresAt scopes rateLimits")

      if (!apiToken) {
        return res.status(401).json({
          success: false,
          message: "Invalid or expired API token",
          isValid: false,
          tokenType: "api_token",
        })
      }

      return res.status(200).json({
        success: true,
        message: "API token is valid",
        isValid: true,
        tokenType: "api_token",
        data: {
          name: apiToken.name,
          expiresAt: apiToken.expiresAt,
          scopes: apiToken.scopes,
          rateLimits: apiToken.rateLimits,
          isExpired: apiToken.expiresAt < new Date(),
          daysUntilExpiry: Math.ceil((apiToken.expiresAt - new Date()) / (1000 * 60 * 60 * 24)),
        },
      })
    }

    // Quick JWT validation without database lookup
    const decoded = jwt.verify(token, process.env.JWT_SECRET)

    res.status(200).json({
      success: true,
      message: "JWT token is valid",
      isValid: true,
      tokenType: "jwt",
      data: {
        userId: decoded.id,
        issuedAt: new Date(decoded.iat * 1000),
        expiresAt: new Date(decoded.exp * 1000),
        isExpired: decoded.exp < Date.now() / 1000,
        timeToExpiry: decoded.exp - Math.floor(Date.now() / 1000),
      },
    })
  } catch (error) {
    res.status(401).json({
      success: false,
      message: error.name === "TokenExpiredError" ? "Token expired" : "Invalid token",
      isValid: false,
      error: error.name,
      details: error.message,
    })
  }
})

export default {
  validateToken,
  validateJWTToken,
  validateAPIToken,
  getTokenInfo,
  quickValidateToken,
}
