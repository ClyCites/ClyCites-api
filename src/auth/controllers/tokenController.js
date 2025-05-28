import jwt from "jsonwebtoken"
import ApiToken from "../models/apiTokenModel.js"
import User from "../models/userModel.js"
import { asyncHandler } from "../utils/asyncHandler.js"
import { AppError } from "../utils/appError.js"

// @desc    Validate API token or JWT token
// @route   POST /api/auth/validate-token
// @access  Public (but requires valid token)
export const validateToken = asyncHandler(async (req, res, next) => {
  let token
  let tokenType = "unknown"

  // Extract token from multiple sources
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
    return next(new AppError("Token is required for validation", 400))
  }

  try {
    // First, try to validate as JWT token
    let validationResult = await validateJWTToken(token)

    if (validationResult.success) {
      tokenType = "jwt"
    } else {
      // If JWT validation fails, try API token validation
      validationResult = await validateAPIToken(token)
      if (validationResult.success) {
        tokenType = "api_token"
      }
    }

    if (!validationResult.success) {
      return next(new AppError(validationResult.message || "Invalid token", 401))
    }

    // Return validation result
    res.status(200).json({
      success: true,
      message: "Token validated successfully",
      data: {
        ...validationResult.data,
        tokenType,
        validatedAt: new Date().toISOString(),
      },
    })
  } catch (error) {
    return next(new AppError("Token validation failed", 401))
  }
})

// @desc    Validate JWT token
// @route   POST /api/auth/validate-jwt
// @access  Public (but requires valid JWT)
export const validateJWTToken = async (token) => {
  try {
    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET)

    // Get user from token
    const user = await User.findById(decoded.id)
      .select("-refreshTokens -passwordHistory -mfa.secret")
      .populate({
        path: "organizationMemberships",
        populate: {
          path: "organization role",
          select: "name slug isActive level permissions",
        },
      })

    if (!user) {
      return {
        success: false,
        message: "User no longer exists",
      }
    }

    // Check if user is active
    if (!user.isActive) {
      return {
        success: false,
        message: "User account is inactive",
      }
    }

    // Check if account is locked
    if (user.isLocked) {
      return {
        success: false,
        message: "Account temporarily locked",
      }
    }

    // Get user's organizations
    const organizationMemberships = await getUserOrganizations(user._id)

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
          globalRole: user.globalRole,
          profilePicture: user.profilePicture,
          isEmailVerified: user.isEmailVerified,
          lastLogin: user.lastLogin,
          isActive: user.isActive,
        },
        organizations: organizationMemberships,
        tokenInfo: {
          type: "jwt",
          issuedAt: new Date(decoded.iat * 1000),
          expiresAt: new Date(decoded.exp * 1000),
        },
      },
    }
  } catch (error) {
    if (error.name === "JsonWebTokenError") {
      return {
        success: false,
        message: "Invalid JWT token",
      }
    } else if (error.name === "TokenExpiredError") {
      return {
        success: false,
        message: "JWT token expired",
      }
    } else {
      return {
        success: false,
        message: "JWT token verification failed",
      }
    }
  }
}

// @desc    Validate API token
// @route   POST /api/auth/validate-api-token
// @access  Public (but requires valid API token)
export const validateAPIToken = async (token) => {
  try {
    // Verify API token using the model's static method
    const apiToken = await ApiToken.verifyToken(token)

    if (!apiToken) {
      return {
        success: false,
        message: "Invalid or expired API token",
      }
    }

    // Check if organization is active
    if (!apiToken.organization.isActive) {
      return {
        success: false,
        message: "Organization is inactive",
      }
    }

    // Check if user is active
    if (!apiToken.user.isActive) {
      return {
        success: false,
        message: "User account is inactive",
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
          hasScope: (scope) => apiToken.hasScope(scope),
          hasPermission: (resource, action) => apiToken.hasPermission(resource, action),
        },
        tokenInfo: {
          type: "api_token",
          createdAt: apiToken.createdAt,
          expiresAt: apiToken.expiresAt,
          lastUsedAt: apiToken.usage.lastUsedAt,
          totalRequests: apiToken.usage.totalRequests,
        },
      },
    }
  } catch (error) {
    return {
      success: false,
      message: "API token validation failed",
    }
  }
}

// Helper function to get user organizations
const getUserOrganizations = async (userId) => {
  try {
    const { default: OrganizationMember } = await import("../models/organizationMemberModel.js")

    const memberships = await OrganizationMember.find({
      user: userId,
      status: "active",
    })
      .populate({
        path: "organization",
        select: "name slug isActive subscription",
      })
      .populate({
        path: "role",
        select: "name level permissions",
      })

    return memberships.map((membership) => ({
      organization: {
        id: membership.organization._id,
        name: membership.organization.name,
        slug: membership.organization.slug,
        isActive: membership.organization.isActive,
        subscription: membership.organization.subscription,
      },
      role: {
        id: membership.role._id,
        name: membership.role.name,
        level: membership.role.level,
        permissions: membership.role.permissions,
      },
      status: membership.status,
      joinedAt: membership.joinedAt,
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

  // Extract token
  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1]
  }

  if (!token && req.headers["x-api-key"]) {
    token = req.headers["x-api-key"]
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
          iat: new Date(decoded.payload.iat * 1000),
          exp: new Date(decoded.payload.exp * 1000),
        },
      }
    }
  } catch (error) {
    // Not a JWT, might be API token
    const apiToken = await ApiToken.findOne({
      hashedToken: require("crypto").createHash("sha256").update(token).digest("hex"),
    })
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
      }
    }
  }

  res.status(200).json({
    success: true,
    data: { tokenInfo },
  })
})

export default {
  validateToken,
  validateJWTToken,
  validateAPIToken,
  getTokenInfo,
}
