import asyncHandler from "../utils/asyncHandler.js"
import FarmInput from "../models/farmInputModel.js"
import Farm from "../models/farmModel.js"
import { AppError } from "../utils/appError.js"

// @desc    Get all farm inputs
// @route   GET /api/farms/:farmId/inputs
// @access  Private
export const getFarmInputs = asyncHandler(async (req, res) => {
  const { farmId } = req.params
  const { category, status, lowStock } = req.query

  // Verify farm ownership
  const farm = await Farm.findOne({ _id: farmId, owner: req.user._id })
  if (!farm) {
    throw new AppError("Farm not found or access denied", 404)
  }

  const query = { farm: farmId }

  // Apply filters
  if (category) query.category = category
  if (status) query.status = status
  if (lowStock === "true") {
    query.$expr = { $lt: ["$currentStock", "$minimumStock"] }
  }

  const inputs = await FarmInput.find(query).populate("supplier", "name contact").sort({ createdAt: -1 })

  // Calculate summary statistics
  const totalValue = inputs.reduce((sum, input) => sum + input.currentStock * input.unitCost, 0)
  const lowStockItems = inputs.filter((input) => input.currentStock < input.minimumStock)
  const expiringSoon = inputs.filter((input) => {
    if (!input.expiryDate) return false
    const daysUntilExpiry = Math.ceil((new Date(input.expiryDate) - new Date()) / (1000 * 60 * 60 * 24))
    return daysUntilExpiry <= 30 && daysUntilExpiry > 0
  })

  res.status(200).json({
    status: "success",
    results: inputs.length,
    data: {
      inputs,
      summary: {
        totalValue,
        lowStockCount: lowStockItems.length,
        expiringSoonCount: expiringSoon.length,
        totalItems: inputs.length,
      },
    },
  })
})

// @desc    Add new farm input
// @route   POST /api/farms/:farmId/inputs
// @access  Private
export const addFarmInput = asyncHandler(async (req, res) => {
  const { farmId } = req.params

  // Verify farm ownership
  const farm = await Farm.findOne({ _id: farmId, owner: req.user._id })
  if (!farm) {
    throw new AppError("Farm not found or access denied", 404)
  }

  const inputData = {
    ...req.body,
    farm: farmId,
    addedBy: req.user._id,
  }

  const input = await FarmInput.create(inputData)
  await input.populate("supplier", "name contact")

  res.status(201).json({
    status: "success",
    data: { input },
  })
})

// @desc    Get single farm input
// @route   GET /api/inputs/:inputId
// @access  Private
export const getFarmInput = asyncHandler(async (req, res) => {
  const input = await FarmInput.findById(req.params.inputId)
    .populate("farm", "name")
    .populate("supplier", "name contact email")
    .populate("addedBy", "firstName lastName")

  if (!input) {
    throw new AppError("Input not found", 404)
  }

  // Verify access through farm ownership
  const farm = await Farm.findOne({ _id: input.farm._id, owner: req.user._id })
  if (!farm) {
    throw new AppError("Access denied", 403)
  }

  res.status(200).json({
    status: "success",
    data: { input },
  })
})

// @desc    Update farm input
// @route   PUT /api/inputs/:inputId
// @access  Private
export const updateFarmInput = asyncHandler(async (req, res) => {
  const input = await FarmInput.findById(req.params.inputId)

  if (!input) {
    throw new AppError("Input not found", 404)
  }

  // Verify access through farm ownership
  const farm = await Farm.findOne({ _id: input.farm, owner: req.user._id })
  if (!farm) {
    throw new AppError("Access denied", 403)
  }

  // Track usage if currentStock is being updated
  if (req.body.currentStock !== undefined && req.body.currentStock !== input.currentStock) {
    const usageAmount = input.currentStock - req.body.currentStock
    if (usageAmount > 0) {
      input.usageHistory.push({
        date: new Date(),
        amount: usageAmount,
        purpose: req.body.usagePurpose || "Stock adjustment",
        recordedBy: req.user._id,
      })
    }
  }

  Object.assign(input, req.body)
  input.lastUpdated = new Date()

  await input.save()
  await input.populate("supplier", "name contact")

  res.status(200).json({
    status: "success",
    data: { input },
  })
})

// @desc    Record input usage
// @route   POST /api/inputs/:inputId/usage
// @access  Private
export const recordInputUsage = asyncHandler(async (req, res) => {
  const { amount, purpose, notes } = req.body
  const input = await FarmInput.findById(req.params.inputId)

  if (!input) {
    throw new AppError("Input not found", 404)
  }

  // Verify access through farm ownership
  const farm = await Farm.findOne({ _id: input.farm, owner: req.user._id })
  if (!farm) {
    throw new AppError("Access denied", 403)
  }

  if (amount > input.currentStock) {
    throw new AppError("Usage amount exceeds current stock", 400)
  }

  // Record usage
  input.usageHistory.push({
    date: new Date(),
    amount,
    purpose,
    notes,
    recordedBy: req.user._id,
  })

  // Update current stock
  input.currentStock -= amount
  input.lastUpdated = new Date()

  await input.save()

  res.status(200).json({
    status: "success",
    message: "Usage recorded successfully",
    data: {
      input,
      remainingStock: input.currentStock,
    },
  })
})

// @desc    Get input analytics
// @route   GET /api/farms/:farmId/inputs/analytics
// @access  Private
export const getInputAnalytics = asyncHandler(async (req, res) => {
  const { farmId } = req.params
  const { period = "30" } = req.query

  // Verify farm ownership
  const farm = await Farm.findOne({ _id: farmId, owner: req.user._id })
  if (!farm) {
    throw new AppError("Farm not found or access denied", 404)
  }

  const inputs = await FarmInput.find({ farm: farmId })

  // Calculate analytics
  const totalValue = inputs.reduce((sum, input) => sum + input.currentStock * input.unitCost, 0)
  const totalPurchaseValue = inputs.reduce((sum, input) => sum + input.totalCost, 0)

  // Category breakdown
  const categoryBreakdown = inputs.reduce((acc, input) => {
    if (!acc[input.category]) {
      acc[input.category] = { count: 0, value: 0 }
    }
    acc[input.category].count++
    acc[input.category].value += input.currentStock * input.unitCost
    return acc
  }, {})

  // Usage trends (last 30 days)
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - Number.parseInt(period))

  const usageTrends = inputs
    .map((input) => {
      const recentUsage = input.usageHistory.filter((usage) => new Date(usage.date) >= thirtyDaysAgo)
      const totalUsage = recentUsage.reduce((sum, usage) => sum + usage.amount, 0)

      return {
        name: input.name,
        category: input.category,
        totalUsage,
        usageCount: recentUsage.length,
        averageUsage: recentUsage.length > 0 ? totalUsage / recentUsage.length : 0,
      }
    })
    .filter((item) => item.totalUsage > 0)

  // Alerts
  const lowStockItems = inputs.filter((input) => input.currentStock < input.minimumStock)
  const expiredItems = inputs.filter((input) => input.expiryDate && new Date(input.expiryDate) < new Date())
  const expiringSoon = inputs.filter((input) => {
    if (!input.expiryDate) return false
    const daysUntilExpiry = Math.ceil((new Date(input.expiryDate) - new Date()) / (1000 * 60 * 60 * 24))
    return daysUntilExpiry <= 30 && daysUntilExpiry > 0
  })

  res.status(200).json({
    status: "success",
    data: {
      summary: {
        totalItems: inputs.length,
        totalValue,
        totalPurchaseValue,
        utilizationRate:
          totalPurchaseValue > 0 ? (((totalPurchaseValue - totalValue) / totalPurchaseValue) * 100).toFixed(2) : 0,
      },
      categoryBreakdown,
      usageTrends,
      alerts: {
        lowStock: lowStockItems.length,
        expired: expiredItems.length,
        expiringSoon: expiringSoon.length,
      },
      recommendations: [
        ...(lowStockItems.length > 0 ? [`${lowStockItems.length} items are running low on stock`] : []),
        ...(expiredItems.length > 0 ? [`${expiredItems.length} items have expired and should be disposed`] : []),
        ...(expiringSoon.length > 0 ? [`${expiringSoon.length} items will expire within 30 days`] : []),
      ],
    },
  })
})

// @desc    Delete farm input
// @route   DELETE /api/inputs/:inputId
// @access  Private
export const deleteFarmInput = asyncHandler(async (req, res) => {
  const input = await FarmInput.findById(req.params.inputId)

  if (!input) {
    throw new AppError("Input not found", 404)
  }

  // Verify access through farm ownership
  const farm = await Farm.findOne({ _id: input.farm, owner: req.user._id })
  if (!farm) {
    throw new AppError("Access denied", 403)
  }

  await input.deleteOne()

  res.status(200).json({
    status: "success",
    message: "Input deleted successfully",
  })
})
