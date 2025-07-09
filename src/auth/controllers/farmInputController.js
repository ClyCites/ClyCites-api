import { validationResult } from "express-validator"
import FarmInput from "../models/farmInputModel.js"
import Farm from "../models/farmModel.js"
import OrganizationMember from "../models/organizationMemberModel.js"
import { asyncHandler } from "../utils/asyncHandler.js"
import { AppError } from "../utils/appError.js"

// @desc    Create farm input
// @route   POST /api/farms/:farmId/inputs
// @access  Private (Farm owner or org member)
export const createFarmInput = asyncHandler(async (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return next(new AppError("Validation failed", 400, errors.array()))
  }

  const farmId = req.params.farmId
  const {
    inputType,
    inputName,
    brand,
    supplier,
    purchaseInfo,
    currentStock,
    minimumStock,
    expiryDate,
    storageLocation,
    storageConditions,
    safetyInfo,
    qualityMetrics,
    certifications,
    crop,
    livestock,
    tags,
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

  const farmInput = await FarmInput.create({
    farm: farmId,
    crop,
    livestock,
    inputType,
    inputName,
    brand,
    supplier,
    purchaseInfo,
    currentStock: currentStock || purchaseInfo.quantity,
    minimumStock: minimumStock || 0,
    expiryDate,
    storageLocation,
    storageConditions,
    safetyInfo,
    qualityMetrics,
    certifications,
    tags,
    metadata,
  })

  res.status(201).json({
    success: true,
    message: "Farm input created successfully",
    data: { farmInput },
  })
})

// @desc    Get farm inputs
// @route   GET /api/farms/:farmId/inputs
// @access  Private (Farm owner or org member)
export const getFarmInputs = asyncHandler(async (req, res, next) => {
  const farmId = req.params.farmId
  const { inputType, lowStock, expired, page = 1, limit = 20 } = req.query

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

  const skip = (Number.parseInt(page) - 1) * Number.parseInt(limit)
  const query = { farm: farmId, isActive: true }

  if (inputType) {
    query.inputType = inputType
  }

  if (lowStock === "true") {
    query.$expr = { $lte: ["$currentStock", "$minimumStock"] }
  }

  if (expired === "true") {
    query.expiryDate = { $lt: new Date() }
  }

  const inputs = await FarmInput.find(query)
    .populate("crop", "name category")
    .populate("livestock", "herdName animalType")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number.parseInt(limit))

  const total = await FarmInput.countDocuments(query)

  // Add calculated fields
  const inputsWithCalculations = inputs.map((input) => ({
    ...input.toObject(),
    totalUsed: input.totalUsed,
    stockPercentage: input.stockPercentage,
    costPerUnitUsed: input.costPerUnitUsed,
    daysUntilExpiry: input.daysUntilExpiry,
    isLowStock: input.isLowStock,
    isExpired: input.isExpired,
    alerts: input.checkAlerts(),
  }))

  res.status(200).json({
    success: true,
    data: {
      inputs: inputsWithCalculations,
      pagination: {
        page: Number.parseInt(page),
        limit: Number.parseInt(limit),
        total,
        pages: Math.ceil(total / Number.parseInt(limit)),
      },
    },
  })
})

// @desc    Get input details
// @route   GET /api/inputs/:inputId
// @access  Private (Farm owner or org member)
export const getInputDetails = asyncHandler(async (req, res, next) => {
  const inputId = req.params.inputId

  const input = await FarmInput.findById(inputId)
    .populate("farm", "name owner organization")
    .populate("crop", "name category growthStage")
    .populate("livestock", "herdName animalType totalAnimals")
    .populate("usage.appliedBy", "firstName lastName")

  if (!input) {
    return next(new AppError("Input not found", 404))
  }

  // Check permissions
  const isOwner = input.farm.owner.toString() === req.user.id
  const membership = await OrganizationMember.findOne({
    user: req.user.id,
    organization: input.farm.organization,
    status: "active",
  })

  if (!isOwner && !membership) {
    return next(new AppError("Access denied", 403))
  }

  const inputWithCalculations = {
    ...input.toObject(),
    totalUsed: input.totalUsed,
    stockPercentage: input.stockPercentage,
    costPerUnitUsed: input.costPerUnitUsed,
    daysUntilExpiry: input.daysUntilExpiry,
    isLowStock: input.isLowStock,
    isExpired: input.isExpired,
    alerts: input.checkAlerts(),
  }

  res.status(200).json({
    success: true,
    data: { input: inputWithCalculations },
  })
})

// @desc    Update farm input
// @route   PUT /api/inputs/:inputId
// @access  Private (Farm owner or org member)
export const updateFarmInput = asyncHandler(async (req, res, next) => {
  const inputId = req.params.inputId

  const input = await FarmInput.findById(inputId).populate("farm")
  if (!input) {
    return next(new AppError("Input not found", 404))
  }

  // Check permissions
  const isOwner = input.farm.owner.toString() === req.user.id
  const membership = await OrganizationMember.findOne({
    user: req.user.id,
    organization: input.farm.organization,
    status: "active",
  })

  if (!isOwner && !membership) {
    return next(new AppError("Access denied", 403))
  }

  const allowedFields = [
    "inputName",
    "brand",
    "supplier",
    "currentStock",
    "minimumStock",
    "expiryDate",
    "storageLocation",
    "storageConditions",
    "safetyInfo",
    "qualityMetrics",
    "certifications",
    "tags",
    "metadata",
  ]

  const updates = {}
  allowedFields.forEach((field) => {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field]
    }
  })

  const updatedInput = await FarmInput.findByIdAndUpdate(inputId, updates, {
    new: true,
    runValidators: true,
  })

  res.status(200).json({
    success: true,
    message: "Input updated successfully",
    data: { input: updatedInput },
  })
})

// @desc    Add input usage
// @route   POST /api/inputs/:inputId/usage
// @access  Private (Farm owner or org member)
export const addInputUsage = asyncHandler(async (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return next(new AppError("Validation failed", 400, errors.array()))
  }

  const inputId = req.params.inputId
  const { quantity, purpose, applicationMethod, weatherConditions, effectiveness, notes } = req.body

  const input = await FarmInput.findById(inputId).populate("farm")
  if (!input) {
    return next(new AppError("Input not found", 404))
  }

  // Check permissions
  const isOwner = input.farm.owner.toString() === req.user.id
  const membership = await OrganizationMember.findOne({
    user: req.user.id,
    organization: input.farm.organization,
    status: "active",
  })

  if (!isOwner && !membership) {
    return next(new AppError("Access denied", 403))
  }

  if (quantity > input.currentStock) {
    return next(new AppError("Insufficient stock available", 400))
  }

  const usageData = {
    date: new Date(),
    quantity,
    purpose,
    appliedBy: req.user.id,
    applicationMethod,
    weatherConditions,
    effectiveness,
    notes,
  }

  await input.addUsage(usageData)

  res.status(201).json({
    success: true,
    message: "Usage recorded successfully",
    data: {
      usage: usageData,
      remainingStock: input.currentStock,
    },
  })
})

// @desc    Update stock level
// @route   PUT /api/inputs/:inputId/stock
// @access  Private (Farm owner or org member)
export const updateStockLevel = asyncHandler(async (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return next(new AppError("Validation failed", 400, errors.array()))
  }

  const inputId = req.params.inputId
  const { newStock, reason } = req.body

  const input = await FarmInput.findById(inputId).populate("farm")
  if (!input) {
    return next(new AppError("Input not found", 404))
  }

  // Check permissions
  const isOwner = input.farm.owner.toString() === req.user.id
  const membership = await OrganizationMember.findOne({
    user: req.user.id,
    organization: input.farm.organization,
    status: "active",
  })

  if (!isOwner && !membership) {
    return next(new AppError("Access denied", 403))
  }

  await input.updateStock(newStock, reason)

  res.status(200).json({
    success: true,
    message: "Stock level updated successfully",
    data: {
      input: {
        id: input._id,
        name: input.inputName,
        previousStock: input.currentStock,
        newStock,
        reason,
      },
    },
  })
})

// @desc    Get cost analysis
// @route   GET /api/farms/:farmId/inputs/cost-analysis
// @access  Private (Farm owner or org member)
export const getCostAnalysis = asyncHandler(async (req, res, next) => {
  const farmId = req.params.farmId
  const { startDate, endDate, period = "month" } = req.query

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

  let start, end
  if (startDate && endDate) {
    start = new Date(startDate)
    end = new Date(endDate)
  } else {
    end = new Date()
    switch (period) {
      case "week":
        start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case "month":
        start = new Date(end.getFullYear(), end.getMonth() - 1, end.getDate())
        break
      case "quarter":
        start = new Date(end.getFullYear(), end.getMonth() - 3, end.getDate())
        break
      case "year":
        start = new Date(end.getFullYear() - 1, end.getMonth(), end.getDate())
        break
      default:
        start = new Date(end.getFullYear(), end.getMonth() - 1, end.getDate())
    }
  }

  const costAnalysis = await FarmInput.getCostAnalysis(farmId, start, end)

  // Get additional metrics
  const [totalInputs, lowStockInputs, expiredInputs] = await Promise.all([
    FarmInput.countDocuments({ farm: farmId, isActive: true }),
    FarmInput.countDocuments({
      farm: farmId,
      isActive: true,
      $expr: { $lte: ["$currentStock", "$minimumStock"] },
    }),
    FarmInput.countDocuments({
      farm: farmId,
      isActive: true,
      expiryDate: { $lt: new Date() },
    }),
  ])

  const totalCost = costAnalysis.reduce((sum, item) => sum + item.totalCost, 0)
  const totalQuantity = costAnalysis.reduce((sum, item) => sum + item.totalQuantity, 0)

  res.status(200).json({
    success: true,
    data: {
      period: { start, end, type: period },
      summary: {
        totalCost,
        totalQuantity,
        averageCostPerUnit: totalQuantity > 0 ? totalCost / totalQuantity : 0,
        totalInputTypes: costAnalysis.length,
        totalInputs,
        lowStockInputs,
        expiredInputs,
      },
      breakdown: costAnalysis,
    },
  })
})

// @desc    Get low stock alerts
// @route   GET /api/farms/:farmId/inputs/low-stock
// @access  Private (Farm owner or org member)
export const getLowStockAlerts = asyncHandler(async (req, res, next) => {
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

  const [lowStockItems, expiringItems] = await Promise.all([
    FarmInput.getLowStockItems(farmId),
    FarmInput.getExpiringItems(farmId, 30),
  ])

  const alerts = []

  // Add low stock alerts
  lowStockItems.forEach((item) => {
    alerts.push({
      type: "low_stock",
      severity: "medium",
      item: {
        id: item._id,
        name: item.inputName,
        type: item.inputType,
        currentStock: item.currentStock,
        minimumStock: item.minimumStock,
        unit: item.purchaseInfo.unit,
      },
      message: `${item.inputName} is running low on stock`,
      recommendedAction: "Reorder this item to avoid stockout",
    })
  })

  // Add expiring items alerts
  expiringItems.forEach((item) => {
    const daysUntilExpiry = Math.ceil((item.expiryDate - new Date()) / (1000 * 60 * 60 * 24))
    alerts.push({
      type: "expiring_soon",
      severity: daysUntilExpiry <= 7 ? "high" : "medium",
      item: {
        id: item._id,
        name: item.inputName,
        type: item.inputType,
        expiryDate: item.expiryDate,
        daysUntilExpiry,
        currentStock: item.currentStock,
        unit: item.purchaseInfo.unit,
      },
      message: `${item.inputName} expires in ${daysUntilExpiry} days`,
      recommendedAction: daysUntilExpiry <= 7 ? "Use immediately or dispose safely" : "Plan usage before expiry",
    })
  })

  res.status(200).json({
    success: true,
    data: {
      alerts,
      summary: {
        lowStockItems: lowStockItems.length,
        expiringItems: expiringItems.length,
        totalAlerts: alerts.length,
      },
    },
  })
})

export default {
  createFarmInput,
  getFarmInputs,
  getInputDetails,
  updateFarmInput,
  addInputUsage,
  updateStockLevel,
  getCostAnalysis,
  getLowStockAlerts,
}
