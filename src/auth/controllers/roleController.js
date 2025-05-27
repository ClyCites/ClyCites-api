import { validationResult } from "express-validator"
import Role from "../models/roleModel.js"
import OrganizationMember from "../models/organizationMemberModel.js"
import { asyncHandler } from "../utils/asyncHandler.js"
import { AppError } from "../utils/appError.js"

// @desc    Create role
// @route   POST /api/organizations/:orgId/roles
// @access  Private (Admin+)
export const createRole = asyncHandler(async (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return next(new AppError("Validation failed", 400, errors.array()))
  }

  const { name, description, permissions, level, inheritsFrom } = req.body
  const organizationId = req.params.orgId

  // Check permissions
  const membership = await OrganizationMember.findOne({
    user: req.user.id,
    organization: organizationId,
    status: "active",
  }).populate("role")

  if (!membership || membership.role.level < 90) {
    return next(new AppError("Insufficient permissions to create roles", 403))
  }

  const role = await Role.create({
    name,
    description,
    organization: organizationId,
    permissions,
    level,
    inheritsFrom,
    createdBy: req.user.id,
  })

  res.status(201).json({
    success: true,
    message: "Role created successfully",
    data: { role },
  })
})

// @desc    Get organization roles
// @route   GET /api/organizations/:orgId/roles
// @access  Private (Member+)
export const getOrganizationRoles = asyncHandler(async (req, res, next) => {
  const organizationId = req.params.orgId

  // Check organization membership
  const membership = await OrganizationMember.findOne({
    user: req.user.id,
    organization: organizationId,
    status: "active",
  })

  if (!membership && req.user.globalRole !== "super_admin") {
    return next(new AppError("Access denied", 403))
  }

  const roles = await Role.find({
    organization: organizationId,
    isActive: true,
  })
    .populate("inheritsFrom", "name")
    .sort({ level: -1, name: 1 })

  res.status(200).json({
    success: true,
    data: { roles },
  })
})

// @desc    Update role
// @route   PUT /api/roles/:roleId
// @access  Private (Admin+)
export const updateRole = asyncHandler(async (req, res, next) => {
  const role = await Role.findById(req.params.roleId)
  if (!role) {
    return next(new AppError("Role not found", 404))
  }

  // Check permissions
  const membership = await OrganizationMember.findOne({
    user: req.user.id,
    organization: role.organization,
    status: "active",
  }).populate("role")

  if (!membership || membership.role.level < 90) {
    return next(new AppError("Insufficient permissions", 403))
  }

  // Prevent updating system roles
  if (role.isSystem) {
    return next(new AppError("Cannot modify system roles", 400))
  }

  const allowedFields = ["name", "description", "permissions", "level", "inheritsFrom"]
  const updates = {}

  allowedFields.forEach((field) => {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field]
    }
  })

  const updatedRole = await Role.findByIdAndUpdate(req.params.roleId, updates, {
    new: true,
    runValidators: true,
  })

  res.status(200).json({
    success: true,
    message: "Role updated successfully",
    data: { role: updatedRole },
  })
})

export default {
  createRole,
  getOrganizationRoles,
  updateRole,
}
