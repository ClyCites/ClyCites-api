import FarmAlert from "../models/farmAlertModel.js"
import Farm from "../models/farmModel.js"
import OrganizationMember from "../models/organizationMemberModel.js"
import { AppError } from "../utils/appError.js"

// @desc    Get all farm alerts
// @route   GET /api/farms/:farmId/alerts
// @access  Private
export const getFarmAlerts = async (req, res, next) => {
  try {
    const { farmId } = req.params
    const {
      type,
      category,
      priority,
      severity,
      status,
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query

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
    if (type) filter.type = type
    if (category) filter.category = category
    if (priority) filter.priority = priority
    if (severity) filter.severity = severity
    if (status) filter.status = status

    // Remove expired alerts
    filter.expiresAt = { $gt: new Date() }

    const skip = (page - 1) * limit
    const sortOptions = {}
    sortOptions[sortBy] = sortOrder === "desc" ? -1 : 1

    const alerts = await FarmAlert.find(filter)
      .populate("createdBy", "name email")
      .populate("resolvedBy", "name email")
      .populate("assignedTo", "name email")
      .sort(sortOptions)
      .skip(skip)
      .limit(Number.parseInt(limit))

    const total = await FarmAlert.countDocuments(filter)

    // Get alert statistics
    const stats = await FarmAlert.aggregate([
      { $match: { farm: farmId, expiresAt: { $gt: new Date() } } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          critical: { $sum: { $cond: [{ $eq: ["$severity", "critical"] }, 1, 0] } },
          high: { $sum: { $cond: [{ $eq: ["$severity", "high"] }, 1, 0] } },
          medium: { $sum: { $cond: [{ $eq: ["$severity", "medium"] }, 1, 0] } },
          low: { $sum: { $cond: [{ $eq: ["$severity", "low"] }, 1, 0] } },
          active: { $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] } },
          acknowledged: { $sum: { $cond: [{ $eq: ["$status", "acknowledged"] }, 1, 0] } },
          resolved: { $sum: { $cond: [{ $eq: ["$status", "resolved"] }, 1, 0] } },
        },
      },
    ])

    res.status(200).json({
      success: true,
      message: "Farm alerts retrieved successfully",
      data: {
        alerts,
        statistics: stats[0] || {
          total: 0,
          critical: 0,
          high: 0,
          medium: 0,
          low: 0,
          active: 0,
          acknowledged: 0,
          resolved: 0,
        },
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

// @desc    Create new farm alert
// @route   POST /api/farms/:farmId/alerts
// @access  Private
export const createFarmAlert = async (req, res, next) => {
  try {
    const { farmId } = req.params
    const {
      title,
      description,
      type,
      category,
      priority,
      severity,
      source,
      affectedArea,
      recommendedActions,
      expiresAt,
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

    const alert = await FarmAlert.create({
      farm: farmId,
      title,
      description,
      type,
      category,
      priority,
      severity,
      source,
      affectedArea,
      recommendedActions,
      expiresAt,
      createdBy: req.user.id,
    })

    res.status(201).json({
      success: true,
      message: "Farm alert created successfully",
      data: alert,
    })
  } catch (error) {
    next(error)
  }
}

// @desc    Get single farm alert
// @route   GET /api/farms/:farmId/alerts/:alertId
// @access  Private
export const getFarmAlert = async (req, res, next) => {
  try {
    const { farmId, alertId } = req.params

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

    const alert = await FarmAlert.findOne({ _id: alertId, farm: farmId })
      .populate("createdBy", "name email")
      .populate("resolvedBy", "name email")
      .populate("assignedTo", "name email")
      .populate("actionsTaken.takenBy", "name email")

    if (!alert) {
      return next(new AppError("Farm alert not found", 404))
    }

    res.status(200).json({
      success: true,
      message: "Farm alert retrieved successfully",
      data: alert,
    })
  } catch (error) {
    next(error)
  }
}

// @desc    Update farm alert
// @route   PUT /api/farms/:farmId/alerts/:alertId
// @access  Private
export const updateFarmAlert = async (req, res, next) => {
  try {
    const { farmId, alertId } = req.params

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

    const alert = await FarmAlert.findOneAndUpdate(
      { _id: alertId, farm: farmId },
      { ...req.body, updatedBy: req.user.id },
      { new: true, runValidators: true },
    ).populate("createdBy", "name email")

    if (!alert) {
      return next(new AppError("Farm alert not found", 404))
    }

    res.status(200).json({
      success: true,
      message: "Farm alert updated successfully",
      data: alert,
    })
  } catch (error) {
    next(error)
  }
}

// @desc    Acknowledge farm alert
// @route   POST /api/farms/:farmId/alerts/:alertId/acknowledge
// @access  Private
export const acknowledgeFarmAlert = async (req, res, next) => {
  try {
    const { farmId, alertId } = req.params
    const { notes } = req.body

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

    const alert = await FarmAlert.findOne({ _id: alertId, farm: farmId })

    if (!alert) {
      return next(new AppError("Farm alert not found", 404))
    }

    if (alert.status === "resolved") {
      return next(new AppError("Cannot acknowledge a resolved alert", 400))
    }

    alert.status = "acknowledged"
    alert.acknowledgedAt = new Date()
    alert.acknowledgedBy = req.user.id
    alert.acknowledgmentNotes = notes

    await alert.save()

    res.status(200).json({
      success: true,
      message: "Farm alert acknowledged successfully",
      data: alert,
    })
  } catch (error) {
    next(error)
  }
}

// @desc    Resolve farm alert
// @route   POST /api/farms/:farmId/alerts/:alertId/resolve
// @access  Private
export const resolveFarmAlert = async (req, res, next) => {
  try {
    const { farmId, alertId } = req.params
    const { resolution, notes } = req.body

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

    const alert = await FarmAlert.findOne({ _id: alertId, farm: farmId })

    if (!alert) {
      return next(new AppError("Farm alert not found", 404))
    }

    if (alert.status === "resolved") {
      return next(new AppError("Alert is already resolved", 400))
    }

    alert.status = "resolved"
    alert.resolvedAt = new Date()
    alert.resolvedBy = req.user.id
    alert.resolution = resolution
    alert.resolutionNotes = notes

    await alert.save()

    res.status(200).json({
      success: true,
      message: "Farm alert resolved successfully",
      data: alert,
    })
  } catch (error) {
    next(error)
  }
}

// @desc    Add action to farm alert
// @route   POST /api/farms/:farmId/alerts/:alertId/actions
// @access  Private
export const addAlertAction = async (req, res, next) => {
  try {
    const { farmId, alertId } = req.params
    const { action, description, result } = req.body

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

    const alert = await FarmAlert.findOne({ _id: alertId, farm: farmId })

    if (!alert) {
      return next(new AppError("Farm alert not found", 404))
    }

    // Add action to alert
    alert.actionsTaken.push({
      action,
      description,
      result,
      takenAt: new Date(),
      takenBy: req.user.id,
    })

    await alert.save()

    res.status(200).json({
      success: true,
      message: "Action added to alert successfully",
      data: alert,
    })
  } catch (error) {
    next(error)
  }
}

// @desc    Get critical alerts
// @route   GET /api/farms/:farmId/alerts/critical
// @access  Private
export const getCriticalAlerts = async (req, res, next) => {
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

    const criticalAlerts = await FarmAlert.find({
      farm: farmId,
      severity: { $in: ["critical", "high"] },
      status: { $in: ["active", "acknowledged"] },
      expiresAt: { $gt: new Date() },
    })
      .populate("createdBy", "name email")
      .populate("assignedTo", "name email")
      .sort({ createdAt: -1 })

    res.status(200).json({
      success: true,
      message: "Critical alerts retrieved successfully",
      data: {
        alerts: criticalAlerts,
        count: criticalAlerts.length,
      },
    })
  } catch (error) {
    next(error)
  }
}

export default {
  createFarmAlert,
  getFarmAlerts,
  getFarmAlert,
  updateFarmAlert,
  acknowledgeFarmAlert,
  resolveFarmAlert,
  addAlertAction,
  getCriticalAlerts,
}
