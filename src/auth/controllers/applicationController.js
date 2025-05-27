import { validationResult } from "express-validator"
import Application from "../models/applicationModel.js"
import OrganizationMember from "../models/organizationMemberModel.js"
import { asyncHandler } from "../utils/asyncHandler.js"
import { AppError } from "../utils/appError.js"

export const createApplication = asyncHandler(async (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return next(new AppError("Validation failed", 400, errors.array()))
  }

  const { name, description, type, platform, redirectUris, scopes, grantTypes } = req.body
  const organizationId = req.params.orgId

  const membership = await OrganizationMember.findOne({
    user: req.user.id,
    organization: organizationId,
    status: "active",
  }).populate("role")

  if (!membership || membership.role.level < 90) {
    return next(new AppError("Insufficient permissions to create applications", 403))
  }

  const application = await Application.create({
    name,
    description,
    organization: organizationId,
    type,
    platform,
    redirectUris,
    scopes,
    grantTypes,
    createdBy: req.user.id,
  })

  const responseApp = application.toObject()
  delete responseApp.clientSecret

  res.status(201).json({
    success: true,
    message: "Application created successfully",
    data: { application: responseApp },
  })
})

export const getOrganizationApplications = asyncHandler(async (req, res, next) => {
  const organizationId = req.params.orgId

  const membership = await OrganizationMember.findOne({
    user: req.user.id,
    organization: organizationId,
    status: "active",
  }).populate("role")

  if (!membership || membership.role.level < 90) {
    return next(new AppError("Insufficient permissions", 403))
  }

  const applications = await Application.find({
    organization: organizationId,
    isActive: true,
  })
    .select("-clientSecret")
    .populate("createdBy", "firstName lastName email")
    .sort({ createdAt: -1 })

  res.status(200).json({
    success: true,
    data: { applications },
  })
})

export const getApplication = asyncHandler(async (req, res, next) => {
  const application = await Application.findById(req.params.appId)
    .select("-clientSecret")
    .populate("createdBy", "firstName lastName email")

  if (!application) {
    return next(new AppError("Application not found", 404))
  }

  // Check permissions
  const membership = await OrganizationMember.findOne({
    user: req.user.id,
    organization: application.organization,
    status: "active",
  }).populate("role")

  if (!membership || membership.role.level < 90) {
    return next(new AppError("Insufficient permissions", 403))
  }

  res.status(200).json({
    success: true,
    data: { application },
  })
})

// @desc    Regenerate client secret
// @route   POST /api/applications/:appId/regenerate-secret
// @access  Private (Admin+)
export const regenerateClientSecret = asyncHandler(async (req, res, next) => {
  const application = await Application.findById(req.params.appId)

  if (!application) {
    return next(new AppError("Application not found", 404))
  }

  // Check permissions
  const membership = await OrganizationMember.findOne({
    user: req.user.id,
    organization: application.organization,
    status: "active",
  }).populate("role")

  if (!membership || membership.role.level < 90) {
    return next(new AppError("Insufficient permissions", 403))
  }

  // Generate new secret
  const crypto = await import("crypto")
  application.clientSecret = crypto.default.randomBytes(32).toString("hex")
  await application.save()

  res.status(200).json({
    success: true,
    message: "Client secret regenerated successfully",
    data: {
      clientSecret: application.clientSecret,
    },
  })
})

export default {
  createApplication,
  getOrganizationApplications,
  getApplication,
  regenerateClientSecret,
}
