import User from "../models/userModel.js"
import OrganizationMember from "../models/organizationMemberModel.js"
import { asyncHandler } from "../utils/asyncHandler.js"
import { AppError } from "../utils/appError.js"

// @desc    Get all users (Super Admin only)
// @route   GET /api/users
// @access  Private (Super Admin)
export const getAllUsers = asyncHandler(async (req, res, next) => {
  if (req.user.globalRole !== "super_admin") {
    return next(new AppError("Access denied", 403))
  }

  const page = Number.parseInt(req.query.page) || 1
  const limit = Number.parseInt(req.query.limit) || 20
  const skip = (page - 1) * limit
  const search = req.query.search || ""

  const query = search
    ? {
        $or: [
          { firstName: { $regex: search, $options: "i" } },
          { lastName: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
          { username: { $regex: search, $options: "i" } },
        ],
      }
    : {}

  const users = await User.find(query)
    .select("-refreshTokens -passwordHistory -mfa.secret")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)

  const total = await User.countDocuments(query)

  res.status(200).json({
    success: true,
    data: {
      users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    },
  })
})

// @desc    Get organization users
// @route   GET /api/organizations/:orgId/users
// @access  Private (Member+)
export const getOrganizationUsers = asyncHandler(async (req, res, next) => {
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

  const page = Number.parseInt(req.query.page) || 1
  const limit = Number.parseInt(req.query.limit) || 20
  const skip = (page - 1) * limit

  const members = await OrganizationMember.find({
    organization: organizationId,
    status: "active",
  })
    .populate({
      path: "user",
      select: "firstName lastName email profilePicture lastLogin isActive",
    })
    .populate("role", "name level")
    .sort({ joinedAt: -1 })
    .skip(skip)
    .limit(limit)

  const total = await OrganizationMember.countDocuments({
    organization: organizationId,
    status: "active",
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

// @desc    Update user global role (Super Admin only)
// @route   PUT /api/users/:userId/global-role
// @access  Private (Super Admin)
export const updateUserGlobalRole = asyncHandler(async (req, res, next) => {
  if (req.user.globalRole !== "super_admin") {
    return next(new AppError("Access denied", 403))
  }

  const { globalRole } = req.body
  const validRoles = ["super_admin", "system_admin", "support", "user"]

  if (!validRoles.includes(globalRole)) {
    return next(new AppError("Invalid global role", 400))
  }

  const user = await User.findByIdAndUpdate(
    req.params.userId,
    { globalRole, lastModifiedBy: req.user.id },
    { new: true, runValidators: true },
  ).select("-refreshTokens -passwordHistory -mfa.secret")

  if (!user) {
    return next(new AppError("User not found", 404))
  }

  res.status(200).json({
    success: true,
    message: "User global role updated successfully",
    data: { user },
  })
})

// @desc    Deactivate user account
// @route   PUT /api/users/:userId/deactivate
// @access  Private (Admin+)
export const deactivateUser = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.params.userId)

  if (!user) {
    return next(new AppError("User not found", 404))
  }

  // Check permissions (super admin or org admin)
  if (req.user.globalRole !== "super_admin") {
    // Check if user has admin role in any shared organization
    const sharedOrgs = await OrganizationMember.aggregate([
      {
        $match: {
          user: { $in: [req.user._id, user._id] },
          status: "active",
        },
      },
      {
        $group: {
          _id: "$organization",
          users: { $addToSet: "$user" },
          roles: { $push: "$role" },
        },
      },
      {
        $match: {
          users: { $size: 2 }, // Both users are in this org
        },
      },
    ])

    if (sharedOrgs.length === 0) {
      return next(new AppError("Insufficient permissions", 403))
    }

    // Check if current user has admin role in shared org
    const hasAdminRole = await OrganizationMember.findOne({
      user: req.user.id,
      organization: { $in: sharedOrgs.map((org) => org._id) },
      status: "active",
    }).populate("role")

    if (!hasAdminRole || hasAdminRole.role.level < 90) {
      return next(new AppError("Insufficient permissions", 403))
    }
  }

  user.isActive = false
  user.lastModifiedBy = req.user.id
  await user.save()

  res.status(200).json({
    success: true,
    message: "User account deactivated successfully",
  })
})

export default {
  getAllUsers,
  getOrganizationUsers,
  updateUserGlobalRole,
  deactivateUser,
}
