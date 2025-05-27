import { validationResult } from "express-validator"
import Organization from "../models/organizationModel.js"
import OrganizationMember from "../models/organizationMemberModel.js"
import Role from "../models/roleModel.js"
import User from "../models/userModel.js"
import { asyncHandler } from "../utils/asyncHandler.js"
import { AppError } from "../utils/appError.js"
import { sendEmail } from "../utils/emailService.js"

export const createOrganization = asyncHandler(async (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return next(new AppError("Validation failed", 400, errors.array()))
  }

  const { name, description, industry, size, website } = req.body

  // Check if organization with this name already exists
  const existingOrg = await Organization.findOne({
    name: { $regex: new RegExp(`^${name}$`, "i") },
  })

  if (existingOrg) {
    return next(new AppError("Organization with this name already exists", 400))
  }

  // Create organization
  const organization = await Organization.create({
    name,
    description,
    industry,
    size,
    website,
    owner: req.user.id,
    createdBy: req.user.id,
  })

  // Create default roles for the organization
  const defaultRoles = [
    {
      name: "Owner",
      description: "Full access to organization",
      level: 100,
      permissions: [{ resource: "*", actions: ["*"] }],
      isSystem: true,
    },
    {
      name: "Admin",
      description: "Administrative access",
      level: 90,
      permissions: [
        { resource: "users", actions: ["create", "read", "update", "delete", "invite"] },
        { resource: "teams", actions: ["create", "read", "update", "delete", "manage"] },
        { resource: "roles", actions: ["create", "read", "update", "delete"] },
        { resource: "applications", actions: ["create", "read", "update", "delete"] },
      ],
      isSystem: true,
    },
    {
      name: "Manager",
      description: "Team management access",
      level: 70,
      permissions: [
        { resource: "teams", actions: ["create", "read", "update", "manage"] },
        { resource: "users", actions: ["read", "invite"] },
      ],
      isSystem: true,
    },
    {
      name: "Member",
      description: "Standard member access",
      level: 50,
      permissions: [
        { resource: "profile", actions: ["read", "update"] },
        { resource: "teams", actions: ["read"] },
      ],
      isSystem: true,
    },
    {
      name: "Viewer",
      description: "Read-only access",
      level: 10,
      permissions: [
        { resource: "profile", actions: ["read"] },
        { resource: "teams", actions: ["read"] },
      ],
      isSystem: true,
    },
  ]

  const createdRoles = await Role.create(
    defaultRoles.map((role) => ({
      ...role,
      organization: organization._id,
      createdBy: req.user.id,
    })),
  )

  // Add creator as owner
  const ownerRole = createdRoles.find((role) => role.name === "Owner")
  await OrganizationMember.create({
    user: req.user.id,
    organization: organization._id,
    role: ownerRole._id,
    status: "active",
    joinedAt: new Date(),
  })

  res.status(201).json({
    success: true,
    message: "Organization created successfully",
    data: {
      organization: await organization.populate("owner", "firstName lastName email"),
      roles: createdRoles,
    },
  })
})

// @desc    Get user's organizations
// @route   GET /api/organizations
// @access  Private
export const getUserOrganizations = asyncHandler(async (req, res, next) => {
  const memberships = await OrganizationMember.find({
    user: req.user.id,
    status: "active",
  })
    .populate({
      path: "organization",
      populate: {
        path: "owner",
        select: "firstName lastName email",
      },
    })
    .populate("role", "name level")

  const organizations = memberships.map((membership) => ({
    ...membership.organization.toObject(),
    membership: {
      role: membership.role,
      status: membership.status,
      joinedAt: membership.joinedAt,
    },
  }))

  res.status(200).json({
    success: true,
    data: { organizations },
  })
})

// @desc    Get organization details
// @route   GET /api/organizations/:id
// @access  Private
export const getOrganization = asyncHandler(async (req, res, next) => {
  const organization = await Organization.findById(req.params.id).populate("owner", "firstName lastName email")

  if (!organization) {
    return next(new AppError("Organization not found", 404))
  }

  // Check if user is member of organization
  const membership = await OrganizationMember.findOne({
    user: req.user.id,
    organization: organization._id,
    status: "active",
  }).populate("role")

  if (!membership && req.user.globalRole !== "super_admin") {
    return next(new AppError("Access denied", 403))
  }

  // Get organization statistics
  const stats = await Promise.all([
    OrganizationMember.countDocuments({ organization: organization._id, status: "active" }),
    // Add more stats as needed
  ])

  res.status(200).json({
    success: true,
    data: {
      organization,
      membership,
      stats: {
        memberCount: stats[0],
      },
    },
  })
})

// @desc    Update organization
// @route   PUT /api/organizations/:id
// @access  Private (Owner/Admin)
export const updateOrganization = asyncHandler(async (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return next(new AppError("Validation failed", 400, errors.array()))
  }

  const organization = await Organization.findById(req.params.id)

  if (!organization) {
    return next(new AppError("Organization not found", 404))
  }

  // Check permissions
  const membership = await OrganizationMember.findOne({
    user: req.user.id,
    organization: organization._id,
    status: "active",
  }).populate("role")

  if (!membership || membership.role.level < 90) {
    return next(new AppError("Insufficient permissions", 403))
  }

  const allowedFields = ["name", "description", "website", "industry", "size", "settings"]
  const updates = {}

  allowedFields.forEach((field) => {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field]
    }
  })

  const updatedOrganization = await Organization.findByIdAndUpdate(req.params.id, updates, {
    new: true,
    runValidators: true,
  }).populate("owner", "firstName lastName email")

  res.status(200).json({
    success: true,
    message: "Organization updated successfully",
    data: { organization: updatedOrganization },
  })
})

// @desc    Invite user to organization
// @route   POST /api/organizations/:id/invite
// @access  Private (Admin+)
export const inviteUserToOrganization = asyncHandler(async (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return next(new AppError("Validation failed", 400, errors.array()))
  }

  const { email, roleId, message } = req.body
  const organization = await Organization.findById(req.params.id)

  if (!organization) {
    return next(new AppError("Organization not found", 404))
  }

  // Check permissions
  const membership = await OrganizationMember.findOne({
    user: req.user.id,
    organization: organization._id,
    status: "active",
  }).populate("role")

  if (!membership || membership.role.level < 70) {
    return next(new AppError("Insufficient permissions to invite users", 403))
  }

  // Check if role exists and belongs to organization
  const role = await Role.findOne({
    _id: roleId,
    organization: organization._id,
  })

  if (!role) {
    return next(new AppError("Invalid role specified", 400))
  }

  // Check if user already exists
  let user = await User.findOne({ email: email.toLowerCase() })
  let isNewUser = false

  if (!user) {
    // Create placeholder user
    const tempPassword = crypto.randomBytes(16).toString("hex")
    user = await User.create({
      email: email.toLowerCase(),
      username: email.split("@")[0] + "_" + Date.now(),
      firstName: "New",
      lastName: "User",
      password: tempPassword,
      isEmailVerified: false,
    })
    isNewUser = true
  }

  // Check if user is already a member
  const existingMembership = await OrganizationMember.findOne({
    user: user._id,
    organization: organization._id,
  })

  if (existingMembership) {
    return next(new AppError("User is already a member of this organization", 400))
  }

  // Create membership
  const newMembership = await OrganizationMember.create({
    user: user._id,
    organization: organization._id,
    role: role._id,
    status: "pending",
    invitedBy: req.user.id,
    invitedAt: new Date(),
  })

  // Send invitation email
  try {
    const inviteUrl = `${process.env.CLIENT_URL}/invite/organization/${organization._id}/${newMembership._id}`

    await sendEmail({
      email: user.email,
      template: "organizationInvite",
      data: {
        inviterName: req.user.fullName,
        organizationName: organization.name,
        roleName: role.name,
        inviteUrl,
        message: message || "",
        isNewUser,
      },
    })

    res.status(200).json({
      success: true,
      message: "Invitation sent successfully",
      data: {
        membership: await newMembership.populate([
          { path: "user", select: "firstName lastName email" },
          { path: "role", select: "name level" },
        ]),
      },
    })
  } catch (error) {
    // Remove membership if email fails
    await OrganizationMember.findByIdAndDelete(newMembership._id)
    if (isNewUser) {
      await User.findByIdAndDelete(user._id)
    }
    return next(new AppError("Failed to send invitation email", 500))
  }
})

// @desc    Get organization members
// @route   GET /api/organizations/:id/members
// @access  Private (Member+)
export const getOrganizationMembers = asyncHandler(async (req, res, next) => {
  const organization = await Organization.findById(req.params.id)

  if (!organization) {
    return next(new AppError("Organization not found", 404))
  }

  // Check if user is member
  const membership = await OrganizationMember.findOne({
    user: req.user.id,
    organization: organization._id,
    status: "active",
  })

  if (!membership && req.user.globalRole !== "super_admin") {
    return next(new AppError("Access denied", 403))
  }

  const page = Number.parseInt(req.query.page) || 1
  const limit = Number.parseInt(req.query.limit) || 20
  const skip = (page - 1) * limit
  const status = req.query.status || "active"

  const members = await OrganizationMember.find({
    organization: organization._id,
    ...(status !== "all" && { status }),
  })
    .populate("user", "firstName lastName email profilePicture lastLogin")
    .populate("role", "name level")
    .populate("invitedBy", "firstName lastName")
    .sort({ joinedAt: -1 })
    .skip(skip)
    .limit(limit)

  const total = await OrganizationMember.countDocuments({
    organization: organization._id,
    ...(status !== "all" && { status }),
  })

  res.status(200).json({
    success: true,
    data: {
      members,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    },
  })
})

export default {
  createOrganization,
  getUserOrganizations,
  getOrganization,
  updateOrganization,
  inviteUserToOrganization,
  getOrganizationMembers,
}
