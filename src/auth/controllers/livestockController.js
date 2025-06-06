import { validationResult } from "express-validator"
import Livestock from "../models/livestockModel.js"
import Farm from "../models/farmModel.js"
import OrganizationMember from "../models/organizationMemberModel.js"
import { asyncHandler } from "../utils/asyncHandler.js"
import { AppError } from "../utils/appError.js"

// @desc    Create livestock
// @route   POST /api/farms/:farmId/livestock
// @access  Private (Farm owner or org member)
export const createLivestock = asyncHandler(async (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return next(new AppError("Validation failed", 400, errors.array()))
  }

  const farmId = req.params.farmId
  const {
    animalType,
    breed,
    herdName,
    totalAnimals,
    animalDetails,
    housing,
    feeding,
    health,
    production,
    economics,
    weatherSensitivity,
    metadata,
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

  const livestock = await Livestock.create({
    farm: farmId,
    animalType,
    breed,
    herdName,
    totalAnimals,
    animalDetails,
    housing,
    feeding,
    health,
    production,
    economics,
    weatherSensitivity,
    metadata,
  })

  res.status(201).json({
    success: true,
    message: "Livestock created successfully",
    data: { livestock },
  })
})

// @desc    Get farm livestock
// @route   GET /api/farms/:farmId/livestock
// @access  Private (Farm owner or org member)
export const getFarmLivestock = asyncHandler(async (req, res, next) => {
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
  const animalType = req.query.animalType

  const query = { farm: farmId, isActive: true }
  if (animalType) {
    query.animalType = animalType
  }

  const livestock = await Livestock.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit)

  const total = await Livestock.countDocuments(query)

  // Add calculated fields
  const livestockWithCalculations = livestock.map((animal) => ({
    ...animal.toObject(),
    totalMonthlyExpenses: animal.totalMonthlyExpenses,
    totalMonthlyIncome: animal.totalMonthlyIncome,
    monthlyProfit: animal.monthlyProfit,
    upcomingVaccinations: animal.upcomingVaccinations,
  }))

  res.status(200).json({
    success: true,
    data: {
      livestock: livestockWithCalculations,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    },
  })
})

// @desc    Update livestock
// @route   PUT /api/livestock/:livestockId
// @access  Private (Farm owner or org member)
export const updateLivestock = asyncHandler(async (req, res, next) => {
  const livestockId = req.params.livestockId

  const livestock = await Livestock.findById(livestockId).populate("farm")
  if (!livestock) {
    return next(new AppError("Livestock not found", 404))
  }

  // Check permissions
  const isOwner = livestock.farm.owner.toString() === req.user.id
  const membership = await OrganizationMember.findOne({
    user: req.user.id,
    organization: livestock.farm.organization,
    status: "active",
  })

  if (!isOwner && !membership) {
    return next(new AppError("Access denied", 403))
  }

  const allowedFields = [
    "animalType",
    "breed",
    "herdName",
    "totalAnimals",
    "animalDetails",
    "housing",
    "feeding",
    "health",
    "production",
    "economics",
    "weatherSensitivity",
    "metadata",
  ]

  const updates = {}
  allowedFields.forEach((field) => {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field]
    }
  })

  const updatedLivestock = await Livestock.findByIdAndUpdate(livestockId, updates, {
    new: true,
    runValidators: true,
  })

  res.status(200).json({
    success: true,
    message: "Livestock updated successfully",
    data: { livestock: updatedLivestock },
  })
})

// @desc    Get livestock details
// @route   GET /api/livestock/:livestockId
// @access  Private (Farm owner or org member)
export const getLivestockDetails = asyncHandler(async (req, res, next) => {
  const livestockId = req.params.livestockId

  const livestock = await Livestock.findById(livestockId).populate("farm", "name owner organization")

  if (!livestock) {
    return next(new AppError("Livestock not found", 404))
  }

  // Check permissions
  const isOwner = livestock.farm.owner.toString() === req.user.id
  const membership = await OrganizationMember.findOne({
    user: req.user.id,
    organization: livestock.farm.organization,
    status: "active",
  })

  if (!isOwner && !membership) {
    return next(new AppError("Access denied", 403))
  }

  const livestockWithCalculations = {
    ...livestock.toObject(),
    totalMonthlyExpenses: livestock.totalMonthlyExpenses,
    totalMonthlyIncome: livestock.totalMonthlyIncome,
    monthlyProfit: livestock.monthlyProfit,
    upcomingVaccinations: livestock.upcomingVaccinations,
  }

  res.status(200).json({
    success: true,
    data: { livestock: livestockWithCalculations },
  })
})

// @desc    Add livestock record
// @route   POST /api/livestock/:livestockId/records
// @access  Private (Farm owner or org member)
export const addLivestockRecord = asyncHandler(async (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return next(new AppError("Validation failed", 400, errors.array()))
  }

  const livestockId = req.params.livestockId
  const { type, description, quantity, cost, income, notes } = req.body

  const livestock = await Livestock.findById(livestockId).populate("farm")
  if (!livestock) {
    return next(new AppError("Livestock not found", 404))
  }

  // Check permissions
  const isOwner = livestock.farm.owner.toString() === req.user.id
  const membership = await OrganizationMember.findOne({
    user: req.user.id,
    organization: livestock.farm.organization,
    status: "active",
  })

  if (!isOwner && !membership) {
    return next(new AppError("Access denied", 403))
  }

  const record = {
    date: new Date(),
    type,
    description,
    quantity,
    cost,
    income,
    notes,
    performedBy: req.user.id,
  }

  livestock.records.push(record)
  await livestock.save()

  res.status(201).json({
    success: true,
    message: "Livestock record added successfully",
    data: { record: livestock.records[livestock.records.length - 1] },
  })
})

export default {
  createLivestock,
  getFarmLivestock,
  updateLivestock,
  getLivestockDetails,
  addLivestockRecord,
}
