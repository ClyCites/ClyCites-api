import { validationResult } from "express-validator"
import ApiToken from "../models/apiTokenModel.js"
import OrganizationMember from "../models/organizationMemberModel.js"
import Application from "../models/applicationModel.js"
import { asyncHandler } from "../utils/asyncHandler.js"
import { AppError } from "../utils/appError.js"

export const createApiToken = asyncHandler(async (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return next(new AppError("Validation failed", 400, errors.array()))
  }

  const { name, description, scopes, permissions, applicationId, expiresAt } = req.body
  const organizationId = req.params.orgId

  const membership = await OrganizationMember.findOne({
    user: req.user.id,
    organization: organizationId,
    status: "active",
  })

  if (!membership) {
    return next(new AppError("Access denied", 403))
  }

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

  const apiToken = await ApiToken.create({
    name,
    description,
    organization: organizationId,
    application: applicationId,
    user: req.user.id,
    scopes,
    permissions,
    expiresAt,
    createdBy: req.user.id,
  })

  const responseToken = apiToken.toObject()
  const plainToken = responseToken.token
  delete responseToken.token
  delete responseToken.hashedToken

  res.status(201).json({
    success: true,
    message: "API token created successfully",
    data: {
      token: plainToken,
      apiToken: responseToken,
    },
  })
})

export const getUserApiTokens = asyncHandler(async (req, res, next) => {
  const organizationId = req.params.orgId

  const membership = await OrganizationMember.findOne({
    user: req.user.id,
    organization: organizationId,
    status: "active",
  })

  if (!membership) {
    return next(new AppError("Access denied", 403))
  }

  const tokens = await ApiToken.find({
    user: req.user.id,
    organization: organizationId,
    isActive: true,
  })
    .select("-token -hashedToken")
    .populate("application", "name type")
    .sort({ createdAt: -1 })

  res.status(200).json({
    success: true,
    data: { tokens },
  })
})

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

export default {
  createApiToken,
  getUserApiTokens,
  revokeApiToken,
}
