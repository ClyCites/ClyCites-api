import FarmInput from "../models/farmInputModel.js"
import Farm from "../models/farmModel.js"
import OrganizationMember from "../models/organizationMemberModel.js"
import { AppError } from "../utils/appError.js"

// @desc    Create new farm input
// @route   POST /api/farms/:farmId/inputs
// @access  Private
export const createFarmInput = async (req, res, next) => {
  try {
    const { farmId } = req.params
    const {
      name,
      category,
      type,
      supplier,
      purchaseDate,
      expiryDate,
      quantity,
      unit,
      costPerUnit,
      totalCost,
      storageLocation,
      batchNumber,
      description,
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
      name,
      category,
      type,
      supplier,
      purchaseDate,
      expiryDate,
      quantity: {
        current: quantity,
        initial: quantity,
        unit,
      },
      cost: {
        perUnit: costPerUnit,
        total: totalCost,
      },
      storageLocation,
      batchNumber,
      description,
      createdBy: req.user.id,
    })

    res.status(201).json({
      success: true,
      message: "Farm input created successfully",
      data: farmInput,
    })
  } catch (error) {
    next(error)
  }
}

// @desc    Get all farm inputs
// @route   GET /api/farms/:farmId/inputs
// @access  Private
export const getFarmInputs = async (req, res, next) => {
  try {
    const { farmId } = req.params
    const { category, type, status, page = 1, limit = 10 } = req.query

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

    // Build filter
    const filter = { farm: farmId }
    if (category) filter.category = category
    if (type) filter.type = type
    if (status) filter.status = status

    const skip = (page - 1) * limit
    const inputs = await FarmInput.find(filter)
      .populate("createdBy", "name email")
      .populate("usageHistory.usedBy", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number.parseInt(limit))

    const total = await FarmInput.countDocuments(filter)

    res.status(200).json({
      success: true,
      message: "Farm inputs retrieved successfully",
      data: {
        inputs,
        pagination: {
          current: Number.parseInt(page),
          pages: Math.ceil(total / limit),
          total,
        },
      },
    })
  } catch (error) {
    next(error)
  }
}

// @desc    Get single farm input
// @route   GET /api/farms/:farmId/inputs/:inputId
// @access  Private
export const getFarmInput = async (req, res, next) => {
  try {
    const { farmId, inputId } = req.params

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

    const input = await FarmInput.findOne({ _id: inputId, farm: farmId })
      .populate("createdBy", "name email")
      .populate("usageHistory.usedBy", "name")

    if (!input) {
      return next(new AppError("Farm input not found", 404))
    }

    res.status(200).json({
      success: true,
      message: "Farm input retrieved successfully",
      data: input,
    })
  } catch (error) {
    next(error)
  }
}

// @desc    Update farm input
// @route   PUT /api/farms/:farmId/inputs/:inputId
// @access  Private
export const updateFarmInput = async (req, res, next) => {
  try {
    const { farmId, inputId } = req.params

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

    const input = await FarmInput.findOneAndUpdate(
      { _id: inputId, farm: farmId },
      { ...req.body, updatedBy: req.user.id },
      { new: true, runValidators: true },
    ).populate("createdBy", "name email")

    if (!input) {
      return next(new AppError("Farm input not found", 404))
    }

    res.status(200).json({
      success: true,
      message: "Farm input updated successfully",
      data: input,
    })
  } catch (error) {
    next(error)
  }
}

// @desc    Delete farm input
// @route   DELETE /api/farms/:farmId/inputs/:inputId
// @access  Private
export const deleteFarmInput = async (req, res, next) => {
  try {
    const { farmId, inputId } = req.params

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

    const input = await FarmInput.findOneAndDelete({ _id: inputId, farm: farmId })

    if (!input) {
      return next(new AppError("Farm input not found", 404))
    }

    res.status(200).json({
      success: true,
      message: "Farm input deleted successfully",
    })
  } catch (error) {
    next(error)
  }
}

// @desc    Record input usage
// @route   POST /api/farms/:farmId/inputs/:inputId/usage
// @access  Private
export const recordInputUsage = async (req, res, next) => {
  try {
    const { farmId, inputId } = req.params
    const { quantity, purpose, notes } = req.body

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

    const input = await FarmInput.findOne({ _id: inputId, farm: farmId })

    if (!input) {
      return next(new AppError("Farm input not found", 404))
    }

    if (input.quantity.current < quantity) {
      return next(new AppError("Insufficient quantity available", 400))
    }

    // Update current quantity
    input.quantity.current -= quantity

    // Add usage record
    input.usageHistory.push({
      date: new Date(),
      quantity,
      purpose,
      notes,
      usedBy: req.user.id,
    })

    // Update status based on remaining quantity
    if (input.quantity.current === 0) {
      input.status = "depleted"
    } else if (input.quantity.current <= input.lowStockThreshold) {
      input.status = "low_stock"
    }

    await input.save()

    res.status(200).json({
      success: true,
      message: "Input usage recorded successfully",
      data: input,
    })
  } catch (error) {
    next(error)
  }
}

// @desc    Get low stock inputs
// @route   GET /api/farms/:farmId/inputs/low-stock
// @access  Private
export const getLowStockInputs = async (req, res, next) => {
  try {
    const { farmId } = req.params

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

    const lowStockInputs = await FarmInput.find({
      farm: farmId,
      status: { $in: ["low_stock", "depleted"] },
    }).populate("createdBy", "name email")

    res.status(200).json({
      success: true,
      message: "Low stock inputs retrieved successfully",
      data: {
        inputs: lowStockInputs,
        count: lowStockInputs.length,
      },
    })
  } catch (error) {
    next(error)
  }
}

// @desc    Get expiring inputs
// @route   GET /api/farms/:farmId/inputs/expiring
// @access  Private
export const getExpiringInputs = async (req, res, next) => {
  try {
    const { farmId } = req.params
    const { days = 30 } = req.query

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

    const expiryDate = new Date()
    expiryDate.setDate(expiryDate.getDate() + Number.parseInt(days))

    const expiringInputs = await FarmInput.find({
      farm: farmId,
      expiryDate: { $lte: expiryDate },
      status: { $ne: "depleted" },
    }).populate("createdBy", "name email")

    res.status(200).json({
      success: true,
      message: "Expiring inputs retrieved successfully",
      data: {
        inputs: expiringInputs,
        count: expiringInputs.length,
      },
    })
  } catch (error) {
    next(error)
  }
}

export default {
  createFarmInput,
  getFarmInputs,
  getFarmInput,
  updateFarmInput,
  deleteFarmInput,
  recordInputUsage,
  getLowStockInputs,
  getExpiringInputs,
}
