import { validationResult } from "express-validator"
import ApiToken from "../models/apiTokenModel.js"
import OrganizationMember from "../models/organizationMemberModel.js"
import Application from "../models/applicationModel.js"
import { asyncHandler } from "../utils/asyncHandler.js"
import { AppError } from "../utils/appError.js"

// @desc    Create API token
// @route   POST /api/organizations/:orgId/tokens
// @access  Private (Member+)
export const createApiToken = asyncHandler(async (req, res, next) => {
  // Debug: Log the received request body
  console.log("Received request body:", JSON.stringify(req.body, null, 2))
  console.log("Request headers:", req.headers["content-type"])

  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    console.log("Validation errors:", JSON.stringify(errors.array(), null, 2))
    return next(new AppError("Validation failed", 400, errors.array()))
  }

  const { name, description, scopes, permissions, applicationId, expiresAt, rateLimits } = req.body
  const organizationId = req.params.orgId

  if (!organizationId) {
    return next(new AppError("Organization ID is required", 400))
  }

  // Check organization membership
  const membership = await OrganizationMember.findOne({
    user: req.user.id,
    organization: organizationId,
    status: "active",
  }).populate("role")

  if (!membership) {
    return next(new AppError("Access denied - not a member of this organization", 403))
  }

  // Validate application if specified
  let application = null
  if (applicationId) {
    application = await Application.findOne({
      _id: applicationId,
      organization: organizationId,
    })
    if (!application) {
      return next(new AppError("Application not found", 404))
    }
  }

  // Validate scopes based on user's role level
  const allowedScopes = getScopesForRoleLevel(membership.role.level)
  const invalidScopes = scopes.filter((scope) => !allowedScopes.includes(scope))

  if (invalidScopes.length > 0) {
    return next(new AppError(`Invalid scopes for your role: ${invalidScopes.join(", ")}`, 400))
  }

  // Set default expiration if not provided (1 year)
  const tokenExpiration = expiresAt ? new Date(expiresAt) : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)

  // Validate expiration date
  if (tokenExpiration <= new Date()) {
    return next(new AppError("Expiration date must be in the future", 400))
  }

  // Set default rate limits based on role level
  const defaultRateLimits = getRateLimitsForRoleLevel(membership.role.level)
  const finalRateLimits = rateLimits
    ? {
        requestsPerMinute: Math.min(
          rateLimits.requestsPerMinute || defaultRateLimits.requestsPerMinute,
          defaultRateLimits.requestsPerMinute,
        ),
        requestsPerHour: Math.min(
          rateLimits.requestsPerHour || defaultRateLimits.requestsPerHour,
          defaultRateLimits.requestsPerHour,
        ),
        requestsPerDay: Math.min(
          rateLimits.requestsPerDay || defaultRateLimits.requestsPerDay,
          defaultRateLimits.requestsPerDay,
        ),
      }
    : defaultRateLimits

  const apiToken = await ApiToken.create({
    name,
    description,
    organization: organizationId,
    application: applicationId,
    user: req.user.id,
    scopes,
    permissions: permissions || [],
    expiresAt: tokenExpiration,
    rateLimits: finalRateLimits,
    createdBy: req.user.id,
  })

  // Return the token only once (for security)
  const responseToken = apiToken.toObject()
  const plainToken = responseToken.token
  delete responseToken.token
  delete responseToken.hashedToken

  res.status(201).json({
    success: true,
    message: "API token created successfully",
    data: {
      token: plainToken, // Show only once
      apiToken: responseToken,
      usage: {
        curl: `curl -H "x-api-key: ${plainToken}" ${req.protocol}://${req.get("host")}/api/...`,
        javascript: `fetch('${req.protocol}://${req.get("host")}/api/...', { headers: { 'x-api-key': '${plainToken}' } })`,
        authorization: `Authorization: Bearer ${plainToken}`,
      },
      warning: "This token will only be shown once. Please save it securely.",
    },
  })
})

// @desc    Get user's API tokens
// @route   GET /api/organizations/:orgId/tokens
// @access  Private
export const getUserApiTokens = asyncHandler(async (req, res, next) => {
  const organizationId = req.params.orgId

  // Check organization membership
  const membership = await OrganizationMember.findOne({
    user: req.user.id,
    organization: organizationId,
    status: "active",
  })

  if (!membership) {
    return next(new AppError("Access denied", 403))
  }

  const page = Number.parseInt(req.query.page) || 1
  const limit = Number.parseInt(req.query.limit) || 20
  const skip = (page - 1) * limit

  const tokens = await ApiToken.find({
    user: req.user.id,
    organization: organizationId,
    isActive: true,
  })
    .select("-token -hashedToken")
    .populate("application", "name type")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)

  const total = await ApiToken.countDocuments({
    user: req.user.id,
    organization: organizationId,
    isActive: true,
  })

  // Add status information to each token
  const tokensWithStatus = tokens.map((token) => ({
    ...token.toObject(),
    status: {
      isExpired: token.expiresAt < new Date(),
      isActive: token.isActive,
      daysUntilExpiry: Math.ceil((token.expiresAt - new Date()) / (1000 * 60 * 60 * 24)),
    },
  }))

  res.status(200).json({
    success: true,
    data: {
      tokens: tokensWithStatus,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
      summary: {
        total,
        active: tokens.filter((t) => t.isActive && t.expiresAt > new Date()).length,
        expired: tokens.filter((t) => t.expiresAt < new Date()).length,
      },
    },
  })
})

// @desc    Get API token details
// @route   GET /api/tokens/:tokenId
// @access  Private
export const getApiTokenDetails = asyncHandler(async (req, res, next) => {
  const token = await ApiToken.findById(req.params.tokenId)
    .select("-token -hashedToken")
    .populate("application", "name type")
    .populate("user", "firstName lastName email")
    .populate("organization", "name slug")

  if (!token) {
    return next(new AppError("Token not found", 404))
  }

  // Check if user owns the token or has admin permissions
  if (token.user._id.toString() !== req.user.id) {
    const membership = await OrganizationMember.findOne({
      user: req.user.id,
      organization: token.organization._id,
      status: "active",
    }).populate("role")

    if (!membership || membership.role.level < 90) {
      return next(new AppError("Insufficient permissions", 403))
    }
  }

  res.status(200).json({
    success: true,
    data: {
      token: {
        ...token.toObject(),
        status: {
          isExpired: token.expiresAt < new Date(),
          isActive: token.isActive,
          daysUntilExpiry: Math.ceil((token.expiresAt - new Date()) / (1000 * 60 * 60 * 24)),
        },
      },
    },
  })
})

// @desc    Update API token
// @route   PUT /api/tokens/:tokenId
// @access  Private
export const updateApiToken = asyncHandler(async (req, res, next) => {
  const { name, description, isActive } = req.body

  const token = await ApiToken.findById(req.params.tokenId)

  if (!token) {
    return next(new AppError("Token not found", 404))
  }

  // Check if user owns the token
  if (token.user.toString() !== req.user.id) {
    return next(new AppError("Insufficient permissions", 403))
  }

  // Update allowed fields
  if (name !== undefined) token.name = name
  if (description !== undefined) token.description = description
  if (isActive !== undefined) token.isActive = isActive

  await token.save()

  res.status(200).json({
    success: true,
    message: "API token updated successfully",
    data: {
      token: {
        ...token.toObject(),
        token: undefined,
        hashedToken: undefined,
      },
    },
  })
})

// @desc    Revoke API token
// @route   DELETE /api/tokens/:tokenId
// @access  Private
export const revokeApiToken = asyncHandler(async (req, res, next) => {
  const token = await ApiToken.findById(req.params.tokenId)

  if (!token) {
    return next(new AppError("Token not found", 404))
  }

  // Check if user owns the token or has admin permissions
  if (token.user.toString() !== req.user.id) {
    const membership = await OrganizationMember.findOne({
      user: req.user.id,
      organization: token.organization,
      status: "active",
    }).populate("role")

    if (!membership || membership.role.level < 90) {
      return next(new AppError("Insufficient permissions", 403))
    }
  }

  token.isActive = false
  await token.save()

  res.status(200).json({
    success: true,
    message: "API token revoked successfully",
  })
})

// @desc    Regenerate API token
// @route   POST /api/tokens/:tokenId/regenerate
// @access  Private
export const regenerateApiToken = asyncHandler(async (req, res, next) => {
  const token = await ApiToken.findById(req.params.tokenId)

  if (!token) {
    return next(new AppError("Token not found", 404))
  }

  // Check if user owns the token
  if (token.user.toString() !== req.user.id) {
    return next(new AppError("Insufficient permissions", 403))
  }

  // Generate new token
  const crypto = await import("crypto")
  const newToken = `clycites_${crypto.default.randomBytes(32).toString("hex")}`
  token.token = newToken
  token.hashedToken = crypto.default.createHash("sha256").update(newToken).digest("hex")

  await token.save()

  res.status(200).json({
    success: true,
    message: "API token regenerated successfully",
    data: {
      token: newToken,
      warning: "This token will only be shown once. Please save it securely.",
      usage: {
        curl: `curl -H "x-api-key: ${newToken}" ${req.protocol}://${req.get("host")}/api/...`,
        javascript: `fetch('${req.protocol}://${req.get("host")}/api/...', { headers: { 'x-api-key': '${newToken}' } })`,
        authorization: `Authorization: Bearer ${newToken}`,
      },
    },
  })
})

// @desc    Test API token
// @route   POST /api/tokens/:tokenId/test
// @access  Private
export const testApiToken = asyncHandler(async (req, res, next) => {
  const token = await ApiToken.findById(req.params.tokenId).select("+token")

  if (!token) {
    return next(new AppError("Token not found", 404))
  }

  // Check if user owns the token
  if (token.user.toString() !== req.user.id) {
    return next(new AppError("Insufficient permissions", 403))
  }

  // Test the token by validating it
  try {
    const validatedToken = await ApiToken.verifyToken(token.token)

    res.status(200).json({
      success: true,
      message: "API token test successful",
      data: {
        isValid: !!validatedToken,
        tokenInfo: validatedToken
          ? {
              name: validatedToken.name,
              scopes: validatedToken.scopes,
              expiresAt: validatedToken.expiresAt,
              usage: validatedToken.usage,
            }
          : null,
        testEndpoint: `${req.protocol}://${req.get("host")}/api/auth/validate-token`,
      },
    })
  } catch (error) {
    res.status(400).json({
      success: false,
      message: "API token test failed",
      error: error.message,
    })
  }
})

// Helper function to get allowed scopes based on role level
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

// Helper function to get rate limits based on role level
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

export default {
  createApiToken,
  getUserApiTokens,
  getApiTokenDetails,
  updateApiToken,
  revokeApiToken,
  regenerateApiToken,
  testApiToken,
}
