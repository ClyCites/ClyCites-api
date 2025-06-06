import { validationResult } from "express-validator"
import Farm from "../models/farmModel.js"
import Crop from "../models/cropModel.js"
import AgricultureActivity from "../models/agricultureActivityModel.js"
import OrganizationMember from "../models/organizationMemberModel.js"
import { asyncHandler } from "../utils/asyncHandler.js"
import { AppError } from "../utils/appError.js"
import { aiRecommendationService } from "../services/aiRecommendationService.js"

// @desc    Create farm
// @route   POST /api/organizations/:orgId/farms
// @access  Private (Member+)
export const createFarm = asyncHandler(async (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return next(new AppError("Validation failed", 400, errors.array()))
  }

  const {
    name,
    location,
    size,
    soilType,
    soilPH,
    irrigationSystem,
    farmType,
    certifications,
    weatherStationId,
    metadata,
  } = req.body
  const organizationId = req.params.orgId

  // Check organization membership
  const membership = await OrganizationMember.findOne({
    user: req.user.id,
    organization: organizationId,
    status: "active",
  }).populate("role")

  if (!membership || membership.role.level < 50) {
    return next(new AppError("Insufficient permissions to create farms", 403))
  }

  const farm = await Farm.create({
    name,
    owner: req.user.id,
    organization: organizationId,
    location,
    size,
    soilType,
    soilPH,
    irrigationSystem,
    farmType,
    certifications,
    weatherStationId,
    metadata,
  })

  res.status(201).json({
    success: true,
    message: "Farm created successfully",
    data: { farm },
  })
})

// @desc    Get organization farms
// @route   GET /api/organizations/:orgId/farms
// @access  Private (Member+)
export const getOrganizationFarms = asyncHandler(async (req, res, next) => {
  const organizationId = req.params.orgId

  // Check organization membership
  const membership = await OrganizationMember.findOne({
    user: req.user.id,
    organization: organizationId,
    status: "active",
  })

  if (!membership) {
    return next(new AppError("Access denied - you are not a member of this organization", 403))
  }

  const page = Number.parseInt(req.query.page) || 1
  const limit = Number.parseInt(req.query.limit) || 20
  const skip = (page - 1) * limit

  const farms = await Farm.find({
    organization: organizationId,
    isActive: true,
  })
    .populate("owner", "firstName lastName email")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)

  const total = await Farm.countDocuments({
    organization: organizationId,
    isActive: true,
  })

  res.status(200).json({
    success: true,
    data: {
      farms,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    },
  })
})

// @desc    Get farm details with AI recommendations
// @route   GET /api/farms/:farmId
// @access  Private (Farm owner or org member)
export const getFarmDetails = asyncHandler(async (req, res, next) => {
  const farmId = req.params.farmId

  const farm = await Farm.findById(farmId)
    .populate("owner", "firstName lastName email")
    .populate("organization", "name")

  if (!farm) {
    return next(new AppError("Farm not found", 404))
  }

  // Check permissions
  const isOwner = farm.owner._id.toString() === req.user.id
  const membership = await OrganizationMember.findOne({
    user: req.user.id,
    organization: farm.organization._id,
    status: "active",
  })

  if (!isOwner && !membership) {
    return next(new AppError("Access denied", 403))
  }

  // Get farm statistics
  const [cropCount, activeActivities, recommendations] = await Promise.all([
    Crop.countDocuments({ farm: farmId, status: { $in: ["planted", "growing"] } }),
    AgricultureActivity.countDocuments({ farm: farmId, status: "in_progress" }),
    aiRecommendationService.getActiveRecommendations(farmId, req.user.id, { limit: 10 }),
  ])

  res.status(200).json({
    success: true,
    data: {
      farm,
      statistics: {
        activeCrops: cropCount,
        activeActivities,
        activeRecommendations: recommendations.length,
      },
      recommendations: recommendations.slice(0, 5), // Top 5 recommendations
    },
  })
})

// @desc    Generate AI recommendations for farm
// @route   POST /api/farms/:farmId/recommendations
// @access  Private (Farm owner or org member)
export const generateFarmRecommendations = asyncHandler(async (req, res, next) => {
  const farmId = req.params.farmId

  const farm = await Farm.findById(farmId)
  if (!farm) {
    return next(new AppError("Farm not found", 404))
  }

  // Check permissions
  const isOwner = farm.owner.toString() === req.user.id
  const membership = await OrganizationMember.findOne({
    user: req.user.id,
    organization: farm.organization,
    status: "active",
  })

  if (!isOwner && !membership) {
    return next(new AppError("Access denied", 403))
  }

  try {
    const recommendations = await aiRecommendationService.generateFarmRecommendations(farmId, req.user.id)

    res.status(200).json({
      success: true,
      message: "AI recommendations generated successfully",
      data: {
        recommendations,
        count: recommendations.length,
      },
    })
  } catch (error) {
    return next(new AppError(`Failed to generate recommendations: ${error.message}`, 500))
  }
})

// @desc    Update farm
// @route   PUT /api/farms/:farmId
// @access  Private (Farm owner or org admin)
export const updateFarm = asyncHandler(async (req, res, next) => {
  const farmId = req.params.farmId

  const farm = await Farm.findById(farmId)
  if (!farm) {
    return next(new AppError("Farm not found", 404))
  }

  // Check permissions
  const isOwner = farm.owner.toString() === req.user.id
  const membership = await OrganizationMember.findOne({
    user: req.user.id,
    organization: farm.organization,
    status: "active",
  }).populate("role")

  if (!isOwner && (!membership || membership.role.level < 70)) {
    return next(new AppError("Insufficient permissions to update this farm", 403))
  }

  const allowedFields = [
    "name",
    "location",
    "size",
    "soilType",
    "soilPH",
    "irrigationSystem",
    "farmType",
    "certifications",
    "weatherStationId",
    "metadata",
  ]
  const updates = {}

  allowedFields.forEach((field) => {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field]
    }
  })

  const updatedFarm = await Farm.findByIdAndUpdate(farmId, updates, {
    new: true,
    runValidators: true,
  }).populate("owner", "firstName lastName email")

  res.status(200).json({
    success: true,
    message: "Farm updated successfully",
    data: { farm: updatedFarm },
  })
})

export default {
  createFarm,
  getOrganizationFarms,
  getFarmDetails,
  generateFarmRecommendations,
  updateFarm,
}
