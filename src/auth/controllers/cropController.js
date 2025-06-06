import { validationResult } from "express-validator"
import Crop from "../models/cropModel.js"
import Farm from "../models/farmModel.js"
import OrganizationMember from "../models/organizationMemberModel.js"
import AgricultureActivity from "../models/agricultureActivityModel.js" // Import AgricultureActivity
import { asyncHandler } from "../utils/asyncHandler.js"
import { AppError } from "../utils/appError.js"

// @desc    Create crop
// @route   POST /api/farms/:farmId/crops
// @access  Private (Farm owner or org member)
export const createCrop = asyncHandler(async (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return next(new AppError("Validation failed", 400, errors.array()))
  }

  const farmId = req.params.farmId
  const {
    name,
    scientificName,
    category,
    variety,
    field,
    season,
    plantingDate,
    expectedHarvestDate,
    growthStage,
    plantingMethod,
    seedSource,
    expectedYield,
    notes,
  } = req.body

  // Check if farm exists and user has access
  const farm = await Farm.findById(farmId)
  if (!farm) {
    return next(new AppError("Farm not found", 404))
  }

  const isOwner = farm.owner.toString() === req.user.id
  const membership = await OrganizationMember.findOne({
    user: req.user.id,
    organization: farm.organization,
    status: "active",
  })

  if (!isOwner && !membership) {
    return next(new AppError("Access denied", 403))
  }

  const crop = await Crop.create({
    name,
    scientificName,
    category,
    variety,
    farm: farmId,
    field,
    season,
    plantingDate,
    expectedHarvestDate,
    growthStage,
    plantingMethod,
    seedSource,
    expectedYield,
    notes,
  })

  res.status(201).json({
    success: true,
    message: "Crop created successfully",
    data: { crop },
  })
})

// @desc    Get farm crops
// @route   GET /api/farms/:farmId/crops
// @access  Private (Farm owner or org member)
export const getFarmCrops = asyncHandler(async (req, res, next) => {
  const farmId = req.params.farmId

  // Check farm access
  const farm = await Farm.findById(farmId)
  if (!farm) {
    return next(new AppError("Farm not found", 404))
  }

  const isOwner = farm.owner.toString() === req.user.id
  const membership = await OrganizationMember.findOne({
    user: req.user.id,
    organization: farm.organization,
    status: "active",
  })

  if (!isOwner && !membership) {
    return next(new AppError("Access denied", 403))
  }

  const page = Number.parseInt(req.query.page) || 1
  const limit = Number.parseInt(req.query.limit) || 20
  const skip = (page - 1) * limit
  const status = req.query.status

  const query = { farm: farmId }
  if (status) {
    query.status = status
  }

  const crops = await Crop.find(query).sort({ plantingDate: -1 }).skip(skip).limit(limit)

  const total = await Crop.countDocuments(query)

  // Add calculated fields
  const cropsWithCalculations = crops.map((crop) => ({
    ...crop.toObject(),
    ageInDays: crop.ageInDays,
    daysToHarvest: crop.daysToHarvest,
  }))

  res.status(200).json({
    success: true,
    data: {
      crops: cropsWithCalculations,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    },
  })
})

// @desc    Update crop
// @route   PUT /api/crops/:cropId
// @access  Private (Farm owner or org member)
export const updateCrop = asyncHandler(async (req, res, next) => {
  const cropId = req.params.cropId

  const crop = await Crop.findById(cropId).populate("farm")
  if (!crop) {
    return next(new AppError("Crop not found", 404))
  }

  // Check permissions
  const isOwner = crop.farm.owner.toString() === req.user.id
  const membership = await OrganizationMember.findOne({
    user: req.user.id,
    organization: crop.farm.organization,
    status: "active",
  })

  if (!isOwner && !membership) {
    return next(new AppError("Access denied", 403))
  }

  const allowedFields = [
    "name",
    "scientificName",
    "category",
    "variety",
    "field",
    "season",
    "plantingDate",
    "expectedHarvestDate",
    "actualHarvestDate",
    "growthStage",
    "plantingMethod",
    "seedSource",
    "expectedYield",
    "actualYield",
    "marketPrice",
    "status",
    "notes",
  ]

  const updates = {}
  allowedFields.forEach((field) => {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field]
    }
  })

  const updatedCrop = await Crop.findByIdAndUpdate(cropId, updates, {
    new: true,
    runValidators: true,
  })

  res.status(200).json({
    success: true,
    message: "Crop updated successfully",
    data: { crop: updatedCrop },
  })
})

// @desc    Get crop details
// @route   GET /api/crops/:cropId
// @access  Private (Farm owner or org member)
export const getCropDetails = asyncHandler(async (req, res, next) => {
  const cropId = req.params.cropId

  const crop = await Crop.findById(cropId).populate("farm", "name owner organization")

  if (!crop) {
    return next(new AppError("Crop not found", 404))
  }

  // Check permissions
  const isOwner = crop.farm.owner.toString() === req.user.id
  const membership = await OrganizationMember.findOne({
    user: req.user.id,
    organization: crop.farm.organization,
    status: "active",
  })

  if (!isOwner && !membership) {
    return next(new AppError("Access denied", 403))
  }

  // Get related activities
  const activities = await AgricultureActivity.find({ crop: cropId })
    .populate("performedBy", "firstName lastName")
    .sort({ actualDate: -1 })
    .limit(10)

  const cropWithCalculations = {
    ...crop.toObject(),
    ageInDays: crop.ageInDays,
    daysToHarvest: crop.daysToHarvest,
    recentActivities: activities,
  }

  res.status(200).json({
    success: true,
    data: { crop: cropWithCalculations },
  })
})

export default {
  createCrop,
  getFarmCrops,
  updateCrop,
  getCropDetails,
}
