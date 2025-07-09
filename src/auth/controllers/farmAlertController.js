import { validationResult } from "express-validator"
import FarmAlert from "../models/farmAlertModel.js"
import Farm from "../models/farmModel.js"
import OrganizationMember from "../models/organizationMemberModel.js"
import { notificationService } from "../services/notificationService.js"
import { asyncHandler } from "../utils/asyncHandler.js"
import { AppError } from "../utils/appError.js"

// @desc    Create farm alert
// @route   POST /api/farms/:farmId/alerts
// @access  Private (Farm owner or org member)
export const createFarmAlert = asyncHandler(async (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return next(new AppError("Validation failed", 400, errors.array()))
  }

  const farmId = req.params.farmId
  const {
    alertType,
    severity,
    priority,
    title,
    message,
    description,
    source,
    sourceDetails,
    relatedEntities,
    data,
    thresholds,
    location,
    timeframe,
    recommendedActions,
    recurrence,
    tags,
    expiresAt,
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

  const alert = await FarmAlert.create({
    farm: farmId,
    user: req.user.id,
    alertType,
    severity,
    priority: priority || 5,
    title,
    message,
    description,
    source: source || "manual",
    sourceDetails: {
      ...sourceDetails,
      userId: req.user.id,
    },
    relatedEntities: relatedEntities || {},
    data: data || {},
    thresholds,
    location,
    timeframe,
    recommendedActions: recommendedActions || [],
    recurrence: recurrence || { isRecurring: false },
    tags: tags || [],
    expiresAt,
    metadata: metadata || {},
  })

  // Send notifications for high priority alerts
  if (["high", "critical", "emergency"].includes(severity)) {
    try {
      await notificationService.sendAlertNotification(req.user.id, alert)
    } catch (error) {
      console.error("Failed to send alert notification:", error)
    }
  }

  res.status(201).json({
    success: true,
    message: "Farm alert created successfully",
    data: { alert },
  })
})

// @desc    Get farm alerts
// @route   GET /api/farms/:farmId/alerts
// @access  Private (Farm owner or org member)
export const getFarmAlerts = asyncHandler(async (req, res, next) => {
  const farmId = req.params.farmId
  const { status, severity, alertType, active = "true", page = 1, limit = 20 } = req.query

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

  const options = {}
  if (severity) options.severity = severity
  if (alertType) options.alertType = alertType

  let alerts
  if (active === "true") {
    alerts = await FarmAlert.getActiveAlerts(farmId, options)
  } else {
    const query = { farm: farmId }
    if (status) query.status = status
    if (severity) query.severity = severity
    if (alertType) query.alertType = alertType

    const skip = (Number.parseInt(page) - 1) * Number.parseInt(limit)
    alerts = await FarmAlert.find(query)
      .populate("relatedEntities.crops", "name category")
      .populate("relatedEntities.livestock", "herdName animalType")
      .populate("relatedEntities.workers", "personalInfo.firstName personalInfo.lastName")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number.parseInt(limit))
  }

  // Add calculated fields
  const alertsWithCalculations = alerts.map((alert) => ({
    ...alert.toObject(),
    timeSinceCreation: alert.timeSinceCreation,
    isExpired: alert.isExpired,
    urgencyScore: alert.urgencyScore,
    estimatedImpact: alert.estimatedImpact,
  }))

  res.status(200).json({
    success: true,
    data: {
      alerts: alertsWithCalculations,
      count: alerts.length,
    },
  })
})

// @desc    Get alert details
// @route   GET /api/alerts/:alertId
// @access  Private (Alert recipient or farm member)
export const getAlertDetails = asyncHandler(async (req, res, next) => {
  const alertId = req.params.alertId

  const alert = await FarmAlert.findById(alertId)
    .populate("farm", "name location")
    .populate("user", "firstName lastName email")
    .populate("relatedEntities.crops", "name category growthStage")
    .populate("relatedEntities.livestock", "herdName animalType totalAnimals")
    .populate("relatedEntities.workers", "personalInfo.firstName personalInfo.lastName employment.position")
    .populate("acknowledgment.acknowledgedBy", "firstName lastName")
    .populate("resolution.resolvedBy", "firstName lastName")

  if (!alert) {
    return next(new AppError("Alert not found", 404))
  }

  // Check access - user must be alert recipient or farm member
  const isRecipient = alert.user._id.toString() === req.user.id
  const membership = await OrganizationMember.findOne({
    user: req.user.id,
    organization: alert.farm.organization,
    status: "active",
  })

  if (!isRecipient && !membership) {
    return next(new AppError("Access denied", 403))
  }

  const alertWithCalculations = {
    ...alert.toObject(),
    timeSinceCreation: alert.timeSinceCreation,
    isExpired: alert.isExpired,
    urgencyScore: alert.urgencyScore,
    estimatedImpact: alert.estimatedImpact,
  }

  res.status(200).json({
    success: true,
    data: { alert: alertWithCalculations },
  })
})

// @desc    Acknowledge alert
// @route   PUT /api/alerts/:alertId/acknowledge
// @access  Private (Alert recipient)
export const acknowledgeAlert = asyncHandler(async (req, res, next) => {
  const alertId = req.params.alertId
  const { notes } = req.body

  const alert = await FarmAlert.findOne({
    _id: alertId,
    user: req.user.id,
  })

  if (!alert) {
    return next(new AppError("Alert not found or access denied", 404))
  }

  if (alert.acknowledgment.acknowledgedAt) {
    return next(new AppError("Alert already acknowledged", 400))
  }

  await alert.acknowledge(req.user.id, notes)

  res.status(200).json({
    success: true,
    message: "Alert acknowledged successfully",
    data: { alert },
  })
})

// @desc    Resolve alert
// @route   PUT /api/alerts/:alertId/resolve
// @access  Private (Alert recipient)
export const resolveAlert = asyncHandler(async (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return next(new AppError("Validation failed", 400, errors.array()))
  }

  const alertId = req.params.alertId
  const { resolution, actionsTaken, effectiveness, cost, timeSpent, notes } = req.body

  const alert = await FarmAlert.findOne({
    _id: alertId,
    user: req.user.id,
  })

  if (!alert) {
    return next(new AppError("Alert not found or access denied", 404))
  }

  if (alert.status === "resolved") {
    return next(new AppError("Alert already resolved", 400))
  }

  const resolutionData = {
    resolution,
    actionsTaken: actionsTaken || [],
    effectiveness: effectiveness ? Number.parseInt(effectiveness) : undefined,
    cost: cost ? Number.parseFloat(cost) : undefined,
    timeSpent: timeSpent ? Number.parseInt(timeSpent) : undefined,
    notes,
  }

  await alert.resolve(req.user.id, resolutionData)

  res.status(200).json({
    success: true,
    message: "Alert resolved successfully",
    data: { alert },
  })
})

// @desc    Escalate alert
// @route   PUT /api/alerts/:alertId/escalate
// @access  Private (Alert recipient)
export const escalateAlert = asyncHandler(async (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return next(new AppError("Validation failed", 400, errors.array()))
  }

  const alertId = req.params.alertId
  const { escalatedTo, reason } = req.body

  const alert = await FarmAlert.findOne({
    _id: alertId,
    user: req.user.id,
  })

  if (!alert) {
    return next(new AppError("Alert not found or access denied", 404))
  }

  if (alert.escalation.escalated) {
    return next(new AppError("Alert already escalated", 400))
  }

  await alert.escalate(req.user.id, escalatedTo, reason)

  // Send notification to escalated user
  try {
    await notificationService.sendEscalationNotification(escalatedTo, alert)
  } catch (error) {
    console.error("Failed to send escalation notification:", error)
  }

  res.status(200).json({
    success: true,
    message: "Alert escalated successfully",
    data: { alert },
  })
})

// @desc    Snooze alert
// @route   PUT /api/alerts/:alertId/snooze
// @access  Private (Alert recipient)
export const snoozeAlert = asyncHandler(async (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return next(new AppError("Validation failed", 400, errors.array()))
  }

  const alertId = req.params.alertId
  const { minutes } = req.body

  const alert = await FarmAlert.findOne({
    _id: alertId,
    user: req.user.id,
  })

  if (!alert) {
    return next(new AppError("Alert not found or access denied", 404))
  }

  await alert.snooze(Number.parseInt(minutes))

  res.status(200).json({
    success: true,
    message: `Alert snoozed for ${minutes} minutes`,
    data: { alert },
  })
})

// @desc    Get critical alerts
// @route   GET /api/farms/:farmId/alerts/critical
// @access  Private (Farm owner or org member)
export const getCriticalAlerts = asyncHandler(async (req, res, next) => {
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

  const criticalAlerts = await FarmAlert.getCriticalAlerts(farmId)

  const alertsWithCalculations = criticalAlerts.map((alert) => ({
    ...alert.toObject(),
    timeSinceCreation: alert.timeSinceCreation,
    urgencyScore: alert.urgencyScore,
    estimatedImpact: alert.estimatedImpact,
  }))

  res.status(200).json({
    success: true,
    data: {
      alerts: alertsWithCalculations,
      count: criticalAlerts.length,
    },
  })
})

// @desc    Get alert statistics
// @route   GET /api/farms/:farmId/alerts/statistics
// @access  Private (Farm owner or org member)
export const getAlertStatistics = asyncHandler(async (req, res, next) => {
  const farmId = req.params.farmId
  const { period = "month" } = req.query

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

  let startDate,
    endDate = new Date()
  switch (period) {
    case "week":
      startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000)
      break
    case "month":
      startDate = new Date(endDate.getFullYear(), endDate.getMonth() - 1, endDate.getDate())
      break
    case "quarter":
      startDate = new Date(endDate.getFullYear(), endDate.getMonth() - 3, endDate.getDate())
      break
    case "year":
      startDate = new Date(endDate.getFullYear() - 1, endDate.getMonth(), endDate.getDate())
      break
    default:
      startDate = new Date(endDate.getFullYear(), endDate.getMonth() - 1, endDate.getDate())
  }

  const [statistics, activeAlerts, totalAlerts] = await Promise.all([
    FarmAlert.getAlertStatistics(farmId, startDate, endDate),
    FarmAlert.countDocuments({
      farm: farmId,
      status: { $in: ["active", "acknowledged", "in_progress"] },
      isActive: true,
    }),
    FarmAlert.countDocuments({
      farm: farmId,
      createdAt: { $gte: startDate, $lte: endDate },
    }),
  ])

  const resolvedAlerts = await FarmAlert.countDocuments({
    farm: farmId,
    status: "resolved",
    createdAt: { $gte: startDate, $lte: endDate },
  })

  const resolutionRate = totalAlerts > 0 ? Math.round((resolvedAlerts / totalAlerts) * 100) : 0

  res.status(200).json({
    success: true,
    data: {
      period: { start: startDate, end: endDate, type: period },
      summary: {
        totalAlerts,
        activeAlerts,
        resolvedAlerts,
        resolutionRate,
        averageResponseTime:
          statistics.reduce((sum, stat) => sum + (stat.avgResponseTime || 0), 0) / statistics.length || 0,
        averageResolutionTime:
          statistics.reduce((sum, stat) => sum + (stat.avgResolutionTime || 0), 0) / statistics.length || 0,
        totalCostImpact: statistics.reduce((sum, stat) => sum + (stat.totalCostImpact || 0), 0),
      },
      breakdown: statistics,
    },
  })
})

// @desc    Dismiss alert
// @route   PUT /api/alerts/:alertId/dismiss
// @access  Private (Alert recipient)
export const dismissAlert = asyncHandler(async (req, res, next) => {
  const alertId = req.params.alertId
  const { reason } = req.body

  const alert = await FarmAlert.findOne({
    _id: alertId,
    user: req.user.id,
  })

  if (!alert) {
    return next(new AppError("Alert not found or access denied", 404))
  }

  alert.status = "dismissed"
  alert.resolution = {
    resolvedAt: new Date(),
    resolvedBy: req.user.id,
    resolution: "dismissed",
    notes: reason || "Alert dismissed by user",
  }

  await alert.save()

  res.status(200).json({
    success: true,
    message: "Alert dismissed successfully",
    data: { alert },
  })
})

export default {
  createFarmAlert,
  getFarmAlerts,
  getAlertDetails,
  acknowledgeAlert,
  resolveAlert,
  escalateAlert,
  snoozeAlert,
  getCriticalAlerts,
  getAlertStatistics,
  dismissAlert,
}
