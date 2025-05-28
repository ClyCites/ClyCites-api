import jwt from "jsonwebtoken"
import ApiToken from "../models/apiTokenModel.js"
import User from "../models/userModel.js"
import OrganizationMember from "../models/organizationMemberModel.js"
import { asyncHandler } from "../utils/asyncHandler.js"
import { AppError } from "../utils/appError.js"

// @desc    Validate API token or JWT token (works with login-generated tokens)
// @route   POST /api/auth/validate-token
// @access  Public (but requires valid token)
export const validateToken = asyncHandler(async (req, res, next) => {
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
    // Check if it's an API token first (they start with 'clycites_')
    if (token.startsWith("clycites_")) {
      const validationResult = await validateAPIToken(token)
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
        },
      })
    }

    // If both fail, return error
    return res.status(401).json({
      success: false,
      message: "Invalid token",
      error: "TOKEN_VALIDATION_FAILED",
      tokenType: tokenType,
    })
  } catch (error) {
    console.error("Token validation error:", error)
    return res.status(401).json({
      success: false,
      message: "Token validation failed",
      error: "VALIDATION_ERROR",
      details: error.message,
    })
  }
})

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

// @desc    Validate API token
const validateAPIToken = async (token) => {
  try {
    // Verify API token using the model's static method
    const apiToken = await ApiToken.verifyToken(token)

    if (!apiToken) {
      return {
        success: false,
        message: "Invalid or expired API token",
        error: "INVALID_API_TOKEN",
      }
    }

    // Check if organization is active
    if (!apiToken.organization.isActive) {
      return {
        success: false,
        message: "Organization is inactive",
        error: "ORGANIZATION_INACTIVE",
      }
    }

    // Check if user is active
    if (!apiToken.user.isActive) {
      return {
        success: false,
        message: "User account is inactive",
        error: "USER_INACTIVE",
      }
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
          fullName: apiToken.user.fullName,
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
          isActive: apiToken.organization.isActive,
          subscription: apiToken.organization.subscription,
        },
        apiToken: {
          id: apiToken._id,
          name: apiToken.name,
          scopes: apiToken.scopes,
          permissions: apiToken.permissions,
          rateLimits: apiToken.rateLimits,
          expiresAt: apiToken.expiresAt,
        },
        tokenInfo: {
          type: "api_token",
          createdAt: apiToken.createdAt,
          expiresAt: apiToken.expiresAt,
          lastUsedAt: apiToken.usage.lastUsedAt,
          totalRequests: apiToken.usage.totalRequests,
          isExpired: apiToken.expiresAt < new Date(),
        },
      },
    }
  } catch (error) {
    return {
      success: false,
      message: "API token validation failed",
      error: "API_TOKEN_VALIDATION_FAILED",
      details: error.message,
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
        rawToken: token.substring(0, 50) + "...",
      }
    }
  } catch (error) {
    // Not a JWT, might be API token
    try {
      const crypto = await import("crypto")
      const hashedToken = crypto.default.createHash("sha256").update(token).digest("hex")

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
          rawToken: token.substring(0, 50) + "...",
        }
      } else {
        tokenInfo = {
          type: "unknown",
          message: "Token format not recognized",
          rawToken: token.substring(0, 50) + "...",
        }
      }
    } catch (apiError) {
      tokenInfo = {
        type: "error",
        message: "Failed to analyze token",
        error: apiError.message,
        rawToken: token.substring(0, 50) + "...",
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
      const apiToken = await ApiToken.verifyToken(token)
      return res.status(200).json({
        success: true,
        message: "API token is valid",
        isValid: true,
        tokenType: "api_token",
        data: {
          name: apiToken.name,
          expiresAt: apiToken.expiresAt,
          isExpired: apiToken.expiresAt < new Date(),
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
