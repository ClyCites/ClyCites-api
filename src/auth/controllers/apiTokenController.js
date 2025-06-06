import { validationResult } from "express-validator"
import ApiToken from "../models/apiTokenModel.js"
import OrganizationMember from "../models/organizationMemberModel.js"
import Application from "../models/applicationModel.js"
import { asyncHandler } from "../utils/asyncHandler.js"
import { AppError } from "../utils/appError.js"
import crypto from "crypto"

const getScopesForRoleLevel = (roleLevel) => {
  const baseScopes = ["profile", "read"]

  if (roleLevel >= 50) {
    baseScopes.push("email", "teams")
  }

  if (roleLevel >= 70) {

    baseScopes.push("users", "write", "invite")
  }

  if (roleLevel >= 85) {
    baseScopes.push("organizations", "roles", "applications", "delete", "manage")
  }

  if (roleLevel >= 90) {
    baseScopes.push("permissions", "billing", "admin")
  }

  if (roleLevel >= 95) {
    baseScopes.push("analytics", "export", "import")
  }

  return baseScopes
}

const rawToken = crypto.randomBytes(32).toString('hex') // 64-char hex string
const plainToken = `clycites_${rawToken}`
const hashedToken = crypto.createHash("sha256").update(plainToken).digest("hex")

const getRateLimitsForRoleLevel = (roleLevel) => {
  if (roleLevel >= 90) {
    return {
      requestsPerMinute: 1000,
      requestsPerHour: 10000,
      requestsPerDay: 100000,
    }
  }

  if (roleLevel >= 70) {
    return {
      requestsPerMinute: 500,
      requestsPerHour: 5000,
      requestsPerDay: 50000,
    }
  }

  if (roleLevel >= 50) {
    return {
      requestsPerMinute: 100,
      requestsPerHour: 1000,
      requestsPerDay: 10000,
    }
  }

  return {
    requestsPerMinute: 60,
    requestsPerHour: 500,
    requestsPerDay: 5000,
  }
}

export const createApiToken = asyncHandler(async (req, res, next) => {
  console.log("=== API Token Creation Request ===")
  console.log("Content-Type:", req.headers["content-type"])
  console.log("Request body:", JSON.stringify(req.body, null, 2))
  console.log("Organization ID:", req.params.orgId)
  console.log("User ID:", req.user?.id)

  if (!req.body || typeof req.body !== "object") {
    return next(new AppError("Invalid request body. Please ensure Content-Type is application/json", 400))
  }

  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    console.log("Validation errors:", JSON.stringify(errors.array(), null, 2))

    const errorMessages = errors.array().map((error) => ({
      field: error.path,
      message: error.msg,
      value: error.value,
    }))

    return next(new AppError("Validation failed", 400, errorMessages))
  }

  const { name, description, scopes, permissions, applicationId, expiresAt, rateLimits } = req.body
  const organizationId = req.params.orgId

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return next(new AppError("Token name is required and must be a non-empty string", 400))
  }

  if (!scopes || !Array.isArray(scopes) || scopes.length === 0) {
    return next(new AppError("At least one scope is required. Scopes must be an array.", 400))
  }

  if (!organizationId) {
    return next(new AppError("Organization ID is required", 400))
  }

  if (!organizationId.match(/^[0-9a-fA-F]{24}$/)) {
    return next(new AppError("Invalid organization ID format", 400))
  }

  try {
    const membership = await OrganizationMember.findOne({
      user: req.user.id,
      organization: organizationId,
      status: "active",
    }).populate("role")

    if (!membership) {
      return next(new AppError("Access denied - you are not a member of this organization", 403))
    }

    if (!membership.role) {
      return next(new AppError("User role not found in organization", 403))
    }

    console.log("User role level:", membership.role.level)

    let application = null
    if (applicationId) {
      if (!applicationId.match(/^[0-9a-fA-F]{24}$/)) {
        return next(new AppError("Invalid application ID format", 400))
      }

      application = await Application.findOne({
        _id: new mongoose.Types.ObjectId(applicationId),
        organization: new mongoose.Types.ObjectId(organizationId),
        isActive: true,
      })


      if (!application) {
        return next(new AppError("Application not found or inactive", 404))
      }
    }

    const allowedScopes = getScopesForRoleLevel(membership.role.level)
    const invalidScopes = scopes.filter((scope) => !allowedScopes.includes(scope))

    if (invalidScopes.length > 0) {
      return next(
        new AppError(
          `Invalid scopes for your role level (${membership.role.level}): ${invalidScopes.join(", ")}. ` +
            `Allowed scopes: ${allowedScopes.join(", ")}`,
          400,
        ),
      )
    }

    let tokenExpiration
    if (expiresAt) {
      tokenExpiration = new Date(expiresAt)
      if (isNaN(tokenExpiration.getTime())) {
        return next(new AppError("Invalid expiration date format", 400))
      }
      if (tokenExpiration <= new Date()) {
        return next(new AppError("Expiration date must be in the future", 400))
      }
      const maxExpiration = new Date(Date.now() + 2 * 365 * 24 * 60 * 60 * 1000)
      if (tokenExpiration > maxExpiration) {
        return next(new AppError("Expiration date cannot be more than 2 years in the future", 400))
      }
    } else {
      tokenExpiration = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
    }

    const defaultRateLimits = getRateLimitsForRoleLevel(membership.role.level)
    let finalRateLimits = defaultRateLimits

    if (rateLimits && typeof rateLimits === "object") {
      finalRateLimits = {
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
    }

    let validatedPermissions = []
    if (permissions && Array.isArray(permissions)) {
      validatedPermissions = permissions.filter(
        (permission) =>
          permission && typeof permission === "object" && permission.resource && Array.isArray(permission.actions),
      )
    }

    const apiToken = await ApiToken.create({
      name: name.trim(),
      description: description ? description.trim() : "",
      organization: organizationId,
      application: applicationId || null,
      user: req.user.id,
      scopes,
      permissions: validatedPermissions,
      expiresAt: tokenExpiration,
      rateLimits: finalRateLimits,
      createdBy: req.user.id,
      token: plainToken,
      hashedToken: hashedToken,
    })


    console.log("API Token created successfully:", apiToken._id)

    const responseToken = apiToken.toObject()
    delete responseToken.hashedToken
    delete responseToken.token


    res.status(201).json({
      success: true,
      message: "API token created successfully",
      data: {
        token: plainToken,
        apiToken: responseToken,
        usage: {
          curl: `curl -H "x-api-key: ${plainToken}" ${req.protocol}://${req.get("host")}/api/...`,
          javascript: `fetch('${req.protocol}://${req.get("host")}/api/...', { headers: { 'x-api-key': '${plainToken}' } })`,
          authorization: `Authorization: Bearer ${plainToken}`,
        },
        warning: "This token will only be shown once. Please save it securely.",
        allowedScopes: allowedScopes,
        maxRateLimits: defaultRateLimits,
      },
    })
  } catch (error) {
    console.error("Error creating API token:", error)

    if (error.name === "ValidationError") {
      const validationErrors = Object.values(error.errors).map((err) => ({
        field: err.path,
        message: err.message,
        value: err.value,
      }))
      return next(new AppError("Database validation failed", 400, validationErrors))
    }

    if (error.code === 11000) {
      return next(new AppError("A token with this name already exists", 400))
    }

    return next(new AppError("Failed to create API token", 500))
  }
})

export const getUserApiTokens = asyncHandler(async (req, res, next) => {
  const organizationId = req.params.orgId

  if (!organizationId || !organizationId.match(/^[0-9a-fA-F]{24}$/)) {
    return next(new AppError("Invalid organization ID", 400))
  }

  const membership = await OrganizationMember.findOne({
    user: req.user.id,
    organization: organizationId,
    status: "active",
  })

  if (!membership) {
    return next(new AppError("Access denied - you are not a member of this organization", 403))
  }

  const page = Math.max(1, Number.parseInt(req.query.page) || 1)
  const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit) || 20))
  const skip = (page - 1) * limit

  const query = {
    user: req.user.id,
    organization: organizationId,
  }

  if (req.query.status === "active") {
    query.isActive = true
    query.expiresAt = { $gt: new Date() }
  } else if (req.query.status === "inactive") {
    query.$or = [{ isActive: false }, { expiresAt: { $lte: new Date() } }]
  }

  try {
    const tokens = await ApiToken.find(query)
      .select("-token -hashedToken")
      .populate("application", "name type")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)

    const total = await ApiToken.countDocuments(query)

    const tokensWithStatus = tokens.map((token) => {
      const now = new Date()
      const isExpired = token.expiresAt < now
      const daysUntilExpiry = Math.ceil((token.expiresAt - now) / (1000 * 60 * 60 * 24))

      return {
        ...token.toObject(),
        status: {
          isExpired,
          isActive: token.isActive && !isExpired,
          daysUntilExpiry: isExpired ? 0 : daysUntilExpiry,
          expiresIn: isExpired ? "Expired" : `${daysUntilExpiry} days`,
        },
      }
    })

    const activeTokens = tokensWithStatus.filter((t) => t.status.isActive).length
    const expiredTokens = tokensWithStatus.filter((t) => t.status.isExpired).length
    const inactiveTokens = tokensWithStatus.filter((t) => !t.isActive).length

    res.status(200).json({
      success: true,
      data: {
        tokens: tokensWithStatus,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1,
        },
        summary: {
          total,
          active: activeTokens,
          expired: expiredTokens,
          inactive: inactiveTokens,
        },
      },
    })
  } catch (error) {
    console.error("Error fetching API tokens:", error)
    return next(new AppError("Failed to fetch API tokens", 500))
  }
})


export const getApiTokenDetails = asyncHandler(async (req, res, next) => {
  const tokenId = req.params.tokenId

  if (!tokenId || !tokenId.match(/^[0-9a-fA-F]{24}$/)) {
    return next(new AppError("Invalid token ID", 400))
  }

  try {
    const token = await ApiToken.findById(tokenId)
      .select("-token -hashedToken")
      .populate("application", "name type platform")
      .populate("user", "firstName lastName email username")
      .populate("organization", "name slug")

    if (!token) {
      return next(new AppError("Token not found", 404))
    }

    if (token.user._id.toString() !== req.user.id) {
      const membership = await OrganizationMember.findOne({
        user: req.user.id,
        organization: token.organization._id,
        status: "active",
      }).populate("role")

      if (!membership || membership.role.level < 90) {
        return next(new AppError("Insufficient permissions to view this token", 403))
      }
    }

    const now = new Date()
    const isExpired = token.expiresAt < now
    const daysUntilExpiry = Math.ceil((token.expiresAt - now) / (1000 * 60 * 60 * 24))

    const tokenWithStatus = {
      ...token.toObject(),
      status: {
        isExpired,
        isActive: token.isActive && !isExpired,
        daysUntilExpiry: isExpired ? 0 : daysUntilExpiry,
        expiresIn: isExpired ? "Expired" : `${daysUntilExpiry} days`,
        lastUsed: token.usage.lastUsedAt
          ? `${Math.floor((now - token.usage.lastUsedAt) / (1000 * 60 * 60 * 24))} days ago`
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
    console.error("Error fetching token details:", error)
    return next(new AppError("Failed to fetch token details", 500))
  }
})

export const updateApiToken = asyncHandler(async (req, res, next) => {
  const tokenId = req.params.tokenId
  const { name, description, isActive } = req.body

  if (!tokenId || !tokenId.match(/^[0-9a-fA-F]{24}$/)) {
    return next(new AppError("Invalid token ID", 400))
  }

  try {
    const token = await ApiToken.findById(tokenId)

    if (!token) {
      return next(new AppError("Token not found", 404))
    }

    if (token.user.toString() !== req.user.id) {
      return next(new AppError("Insufficient permissions to update this token", 403))
    }

    const updates = {}

    if (name !== undefined) {
      if (!name || typeof name !== "string" || name.trim().length === 0) {
        return next(new AppError("Token name must be a non-empty string", 400))
      }
      if (name.trim().length > 100) {
        return next(new AppError("Token name cannot exceed 100 characters", 400))
      }
      updates.name = name.trim()
    }

    if (description !== undefined) {
      if (description && typeof description !== "string") {
        return next(new AppError("Description must be a string", 400))
      }
      if (description && description.length > 500) {
        return next(new AppError("Description cannot exceed 500 characters", 400))
      }
      updates.description = description ? description.trim() : ""
    }

    if (isActive !== undefined) {
      if (typeof isActive !== "boolean") {
        return next(new AppError("isActive must be a boolean value", 400))
      }
      updates.isActive = isActive
    }

    const updatedToken = await ApiToken.findByIdAndUpdate(tokenId, updates, { new: true, runValidators: true }).select(
      "-token -hashedToken",
    )

    res.status(200).json({
      success: true,
      message: "API token updated successfully",
      data: {
        token: updatedToken,
      },
    })
  } catch (error) {
    console.error("Error updating token:", error)

    if (error.name === "ValidationError") {
      const validationErrors = Object.values(error.errors).map((err) => ({
        field: err.path,
        message: err.message,
        value: err.value,
      }))
      return next(new AppError("Validation failed", 400, validationErrors))
    }

    return next(new AppError("Failed to update token", 500))
  }
})
export const revokeApiToken = asyncHandler(async (req, res, next) => {
  const tokenId = req.params.tokenId

  if (!tokenId || !tokenId.match(/^[0-9a-fA-F]{24}$/)) {
    return next(new AppError("Invalid token ID", 400))
  }

  try {
    const token = await ApiToken.findById(tokenId)

    if (!token) {
      return next(new AppError("Token not found", 404))
    }

    if (token.user.toString() !== req.user.id) {
      const membership = await OrganizationMember.findOne({
        user: req.user.id,
        organization: token.organization,
        status: "active",
      }).populate("role")

      if (!membership || membership.role.level < 90) {
        return next(new AppError("Insufficient permissions to revoke this token", 403))
      }
    }

    token.isActive = false
    await token.save()

    res.status(200).json({
      success: true,
      message: "API token revoked successfully",
      data: {
        tokenId: token._id,
        name: token.name,
        revokedAt: new Date(),
      },
    })
  } catch (error) {
    console.error("Error revoking token:", error)
    return next(new AppError("Failed to revoke token", 500))
  }
})

export const regenerateApiToken = asyncHandler(async (req, res, next) => {
  const tokenId = req.params.tokenId

  if (!tokenId || !tokenId.match(/^[0-9a-fA-F]{24}$/)) {
    return next(new AppError("Invalid token ID", 400))
  }

  try {
    const token = await ApiToken.findById(tokenId)

    if (!token) {
      return next(new AppError("Token not found", 404))
    }

    // Check if user owns the token
    if (token.user.toString() !== req.user.id) {
      return next(new AppError("Insufficient permissions to regenerate this token", 403))
    }

    // Check if token is active
    if (!token.isActive) {
      return next(new AppError("Cannot regenerate an inactive token", 400))
    }

    // Generate new token
    const crypto = await import("crypto")
    const newToken = `clycites_${crypto.default.randomBytes(32).toString("hex")}`
    token.token = newToken
    token.hashedToken = crypto.default.createHash("sha256").update(newToken).digest("hex")

    // Reset usage statistics
    token.usage.totalRequests = 0
    token.usage.lastUsedAt = null

    await token.save()

    res.status(200).json({
      success: true,
      message: "API token regenerated successfully",
      data: {
        token: newToken,
        tokenId: token._id,
        name: token.name,
        regeneratedAt: new Date(),
        warning: "This token will only be shown once. Please save it securely.",
        usage: {
          curl: `curl -H "x-api-key: ${newToken}" ${req.protocol}://${req.get("host")}/api/...`,
          javascript: `fetch('${req.protocol}://${req.get("host")}/api/...', { headers: { 'x-api-key': '${newToken}' } })`,
          authorization: `Authorization: Bearer ${newToken}`,
        },
      },
    })
  } catch (error) {
    console.error("Error regenerating token:", error)
    return next(new AppError("Failed to regenerate token", 500))
  }
})

// @desc    Test API token
// @route   POST /api/tokens/:tokenId/test
// @access  Private
export const testApiToken = asyncHandler(async (req, res, next) => {
  const tokenId = req.params.tokenId

  if (!tokenId || !tokenId.match(/^[0-9a-fA-F]{24}$/)) {
    return next(new AppError("Invalid token ID", 400))
  }

  try {
    const token = await ApiToken.findById(tokenId).select("+token")

    if (!token) {
      return next(new AppError("Token not found", 404))
    }

    // Check if user owns the token
    if (token.user.toString() !== req.user.id) {
      return next(new AppError("Insufficient permissions to test this token", 403))
    }

    // Test the token by validating it
    const validatedToken = await ApiToken.verifyToken(token.token)

    const testResult = {
      isValid: !!validatedToken,
      tokenInfo: validatedToken
        ? {
            name: validatedToken.name,
            scopes: validatedToken.scopes,
            expiresAt: validatedToken.expiresAt,
            isActive: validatedToken.isActive,
            usage: validatedToken.usage,
          }
        : null,
      testEndpoint: `${req.protocol}://${req.get("host")}/api/auth/validate-token`,
      testCommands: {
        curl: `curl -H "x-api-key: ${token.token}" ${req.protocol}://${req.get("host")}/api/auth/validate-token`,
        javascript: `fetch('${req.protocol}://${req.get("host")}/api/auth/validate-token', { headers: { 'x-api-key': '${token.token}' } })`,
      },
    }

    res.status(200).json({
      success: true,
      message: validatedToken ? "API token test successful" : "API token test failed",
      data: testResult,
    })
  } catch (error) {
    console.error("Error testing token:", error)
    res.status(400).json({
      success: false,
      message: "API token test failed",
      error: error.message,
    })
  }
})

export default {
  createApiToken,
  getUserApiTokens,
  getApiTokenDetails,
  updateApiToken,
  revokeApiToken,
  regenerateApiToken,
  testApiToken,
}
