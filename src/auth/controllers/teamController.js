import { validationResult } from "express-validator"
import Team from "../models/teamModel.js"
import TeamMember from "../models/teamMemberModel.js"
import OrganizationMember from "../models/organizationMemberModel.js"
import Role from "../models/roleModel.js"
import { asyncHandler } from "../utils/asyncHandler.js"
import { AppError } from "../utils/appError.js"

// @desc    Create team
// @route   POST /api/organizations/:orgId/teams
// @access  Private (Manager+)
export const createTeam = asyncHandler(async (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return next(new AppError("Validation failed", 400, errors.array()))
  }

  const { name, description, type, visibility, parentId } = req.body
  const organizationId = req.params.orgId

  // Check organization membership and permissions
  const orgMembership = await OrganizationMember.findOne({
    user: req.user.id,
    organization: organizationId,
    status: "active",
  }).populate("role")

  if (!orgMembership || orgMembership.role.level < 70) {
    return next(new AppError("Insufficient permissions to create teams", 403))
  }

  // Check if parent team exists (if specified)
  if (parentId) {
    const parentTeam = await Team.findOne({
      _id: parentId,
      organization: organizationId,
    })
    if (!parentTeam) {
      return next(new AppError("Parent team not found", 404))
    }
  }

  const team = await Team.create({
    name,
    description,
    organization: organizationId,
    parent: parentId || null,
    type,
    visibility,
    lead: req.user.id,
    createdBy: req.user.id,
  })

  // Get default team role
  const memberRole = await Role.findOne({
    organization: organizationId,
    name: "Member",
    isSystem: true,
  })

  // Add creator as team member
  await TeamMember.create({
    user: req.user.id,
    team: team._id,
    role: memberRole._id,
    status: "active",
    joinedAt: new Date(),
  })

  res.status(201).json({
    success: true,
    message: "Team created successfully",
    data: { team: await team.populate("lead", "firstName lastName email") },
  })
})

// @desc    Get organization teams
// @route   GET /api/organizations/:orgId/teams
// @access  Private (Member+)
export const getOrganizationTeams = asyncHandler(async (req, res, next) => {
  const organizationId = req.params.orgId

  // Check organization membership
  const orgMembership = await OrganizationMember.findOne({
    user: req.user.id,
    organization: organizationId,
    status: "active",
  })

  if (!orgMembership && req.user.globalRole !== "super_admin") {
    return next(new AppError("Access denied", 403))
  }

  const page = Number.parseInt(req.query.page) || 1
  const limit = Number.parseInt(req.query.limit) || 20
  const skip = (page - 1) * limit

  const teams = await Team.find({
    organization: organizationId,
    isActive: true,
  })
    .populate("lead", "firstName lastName email")
    .populate("parent", "name")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)

  const total = await Team.countDocuments({
    organization: organizationId,
    isActive: true,
  })

  res.status(200).json({
    success: true,
    data: {
      teams,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    },
  })
})

// @desc    Invite user to team
// @route   POST /api/teams/:teamId/invite
// @access  Private (Team Lead/Manager+)
export const inviteUserToTeam = asyncHandler(async (req, res, next) => {
  const { userId, roleId } = req.body
  const teamId = req.params.teamId

  const team = await Team.findById(teamId).populate("organization")
  if (!team) {
    return next(new AppError("Team not found", 404))
  }

  // Check permissions (team lead or org manager+)
  const isTeamLead = team.lead.toString() === req.user.id
  const orgMembership = await OrganizationMember.findOne({
    user: req.user.id,
    organization: team.organization._id,
    status: "active",
  }).populate("role")

  if (!isTeamLead && (!orgMembership || orgMembership.role.level < 70)) {
    return next(new AppError("Insufficient permissions", 403))
  }

  // Check if user is organization member
  const userOrgMembership = await OrganizationMember.findOne({
    user: userId,
    organization: team.organization._id,
    status: "active",
  })

  if (!userOrgMembership) {
    return next(new AppError("User must be organization member first", 400))
  }

  // Check if already team member
  const existingMembership = await TeamMember.findOne({
    user: userId,
    team: teamId,
  })

  if (existingMembership) {
    return next(new AppError("User is already a team member", 400))
  }

  const role = await Role.findById(roleId)
  if (!role) {
    return next(new AppError("Role not found", 404))
  }

  await TeamMember.create({
    user: userId,
    team: teamId,
    role: roleId,
    status: "active",
    invitedBy: req.user.id,
    joinedAt: new Date(),
  })

  res.status(200).json({
    success: true,
    message: "User added to team successfully",
  })
})

export default {
  createTeam,
  getOrganizationTeams,
  inviteUserToTeam,
}
