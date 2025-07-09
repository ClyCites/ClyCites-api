import asyncHandler from "../utils/asyncHandler.js"
import FarmAlert from "../models/farmAlertModel.js"
import Farm from "../models/farmModel.js"
import AppError from "../utils/appError.js"
import { sendNotification } from "../services/notificationService.js"

// @desc    Get all farm alerts
// @route   GET /api/farms/:farmId/alerts
// @access  Private
export const getFarmAlerts = asyncHandler(async (req, res) => {
  const { farmId } = req.params
  const { type, priority, status, resolved } = req.query

  // Verify farm ownership
  const farm = await Farm.findOne({ _id: farmId, owner: req.user._id })
  if (!farm) {
    throw new AppError("Farm not found or access denied", 404)
  }

  const query = { farm: farmId }

  // Apply filters
  if (type) query.type = type
  if (priority) query.priority = priority
  if (status) query.status = status
  if (resolved !== undefined) query.resolved = resolved === "true"

  const alerts = await FarmAlert.find(query)
    .populate("createdBy", "firstName lastName")
    .populate("resolvedBy", "firstName lastName")
    .sort({ createdAt: -1 })

  // Calculate summary statistics
  const activeAlerts = alerts.filter((a) => !a.resolved).length
  const criticalAlerts = alerts.filter((a) => a.priority === "critical" && !a.resolved).length
  const highAlerts = alerts.filter((a) => a.priority === "high" && !a.resolved).length

  const typeBreakdown = alerts.reduce((acc, alert) => {
    if (!acc[alert.type]) acc[alert.type] = { total: 0, active: 0 }
    acc[alert.type].total++
    if (!alert.resolved) acc[alert.type].active++
    return acc
  }, {})

  res.status(200).json({
    status: "success",
    results: alerts.length,
    data: {
      alerts,
      summary: {
        totalAlerts: alerts.length,
        activeAlerts,
        criticalAlerts,
        highAlerts,
        typeBreakdown,
      },
    },
  })
})

// @desc    Create new farm alert
// @route   POST /api/farms/:farmId/alerts
// @access  Private
export const createFarmAlert = asyncHandler(async (req, res) => {
  const { farmId } = req.params

  // Verify farm ownership
  const farm = await Farm.findOne({ _id: farmId, owner: req.user._id })
  if (!farm) {
    throw new AppError("Farm not found or access denied", 404)
  }

  const alertData = {
    ...req.body,
    farm: farmId,
    createdBy: req.user._id,
  }

  const alert = await FarmAlert.create(alertData)
  await alert.populate("createdBy", "firstName lastName")

  // Send notification for high priority alerts
  if (alert.priority === "critical" || alert.priority === "high") {
    try {
      await sendNotification({
        type: "alert",
        recipient: req.user._id,
        title: `${alert.priority.toUpperCase()} Alert: ${alert.title}`,
        message: alert.description,
        data: { alertId: alert._id, farmId },
      })
    } catch (error) {
      console.error("Failed to send alert notification:", error)
    }
  }

  res.status(201).json({
    status: "success",
    data: { alert },
  })
})

// @desc    Get single farm alert
// @route   GET /api/alerts/:alertId
// @access  Private
export const getFarmAlert = asyncHandler(async (req, res) => {
  const alert = await FarmAlert.findById(req.params.alertId)
    .populate("farm", "name")
    .populate("createdBy", "firstName lastName")
    .populate("resolvedBy", "firstName lastName")
    .populate("actions.performedBy", "firstName lastName")

  if (!alert) {
    throw new AppError("Alert not found", 404)
  }

  // Verify access through farm ownership
  const farm = await Farm.findOne({ _id: alert.farm._id, owner: req.user._id })
  if (!farm) {
    throw new AppError("Access denied", 403)
  }

  res.status(200).json({
    status: "success",
    data: { alert },
  })
})

// @desc    Update farm alert
// @route   PUT /api/alerts/:alertId
// @access  Private
export const updateFarmAlert = asyncHandler(async (req, res) => {
  const alert = await FarmAlert.findById(req.params.alertId)

  if (!alert) {
    throw new AppError("Alert not found", 404)
  }

  // Verify access through farm ownership
  const farm = await Farm.findOne({ _id: alert.farm, owner: req.user._id })
  if (!farm) {
    throw new AppError("Access denied", 403)
  }

  Object.assign(alert, req.body)
  alert.lastUpdated = new Date()

  await alert.save()
  await alert.populate("createdBy", "firstName lastName")

  res.status(200).json({
    status: "success",
    data: { alert },
  })
})

// @desc    Resolve farm alert
// @route   PUT /api/alerts/:alertId/resolve
// @access  Private
export const resolveFarmAlert = asyncHandler(async (req, res) => {
  const { resolution, notes } = req.body
  const alert = await FarmAlert.findById(req.params.alertId)

  if (!alert) {
    throw new AppError("Alert not found", 404)
  }

  // Verify access through farm ownership
  const farm = await Farm.findOne({ _id: alert.farm, owner: req.user._id })
  if (!farm) {
    throw new AppError("Access denied", 403)
  }

  alert.resolved = true
  alert.resolvedAt = new Date()
  alert.resolvedBy = req.user._id
  alert.resolution = resolution
  alert.resolutionNotes = notes

  await alert.save()
  await alert.populate(["createdBy", "resolvedBy"], "firstName lastName")

  res.status(200).json({
    status: "success",
    message: "Alert resolved successfully",
    data: { alert },
  })
})

// @desc    Add action to alert
// @route   POST /api/alerts/:alertId/actions
// @access  Private
export const addAlertAction = asyncHandler(async (req, res) => {
  const { action, notes, status } = req.body
  const alert = await FarmAlert.findById(req.params.alertId)

  if (!alert) {
    throw new AppError("Alert not found", 404)
  }

  // Verify access through farm ownership
  const farm = await Farm.findOne({ _id: alert.farm, owner: req.user._id })
  if (!farm) {
    throw new AppError("Access denied", 403)
  }

  alert.actions.push({
    action,
    notes,
    status: status || "completed",
    performedBy: req.user._id,
    performedAt: new Date(),
  })

  alert.lastUpdated = new Date()
  await alert.save()

  res.status(200).json({
    status: "success",
    message: "Action added successfully",
    data: { alert },
  })
})

// @desc    Get alert analytics
// @route   GET /api/farms/:farmId/alerts/analytics
// @access  Private
export const getAlertAnalytics = asyncHandler(async (req, res) => {
  const { farmId } = req.params
  const { period = "30" } = req.query

  // Verify farm ownership
  const farm = await Farm.findOne({ _id: farmId, owner: req.user._id })
  if (!farm) {
    throw new AppError("Farm not found or access denied", 404)
  }

  const periodDays = Number.parseInt(period)
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - periodDays)

  const alerts = await FarmAlert.find({
    farm: farmId,
    createdAt: { $gte: startDate },
  })

  // Calculate analytics
  const totalAlerts = alerts.length
  const resolvedAlerts = alerts.filter((a) => a.resolved).length
  const activeAlerts = totalAlerts - resolvedAlerts
  const resolutionRate = totalAlerts > 0 ? ((resolvedAlerts / totalAlerts) * 100).toFixed(2) : 0

  // Priority breakdown
  const priorityBreakdown = alerts.reduce((acc, alert) => {
    if (!acc[alert.priority]) acc[alert.priority] = { total: 0, resolved: 0 }
    acc[alert.priority].total++
    if (alert.resolved) acc[alert.priority].resolved++
    return acc
  }, {})

  // Type breakdown
  const typeBreakdown = alerts.reduce((acc, alert) => {
    if (!acc[alert.type]) acc[alert.type] = { total: 0, resolved: 0 }
    acc[alert.type].total++
    if (alert.resolved) acc[alert.type].resolved++
    return acc
  }, {})

  // Resolution time analysis
  const resolvedAlertsWithTime = alerts.filter((a) => a.resolved && a.resolvedAt)
  const averageResolutionTime =
    resolvedAlertsWithTime.length > 0
      ? resolvedAlertsWithTime.reduce((sum, alert) => {
          const resolutionTime = new Date(alert.resolvedAt) - new Date(alert.createdAt)
          return sum + resolutionTime
        }, 0) /
        resolvedAlertsWithTime.length /
        (1000 * 60 * 60) // Convert to hours
      : 0

  // Trend analysis (daily counts)
  const dailyTrends = []
  for (let i = periodDays - 1; i >= 0; i--) {
    const date = new Date()
    date.setDate(date.getDate() - i)
    const dayStart = new Date(date.setHours(0, 0, 0, 0))
    const dayEnd = new Date(date.setHours(23, 59, 59, 999))

    const dayAlerts = alerts.filter((a) => new Date(a.createdAt) >= dayStart && new Date(a.createdAt) <= dayEnd)

    dailyTrends.push({
      date: dayStart.toISOString().split("T")[0],
      total: dayAlerts.length,
      critical: dayAlerts.filter((a) => a.priority === "critical").length,
      high: dayAlerts.filter((a) => a.priority === "high").length,
      resolved: dayAlerts.filter((a) => a.resolved).length,
    })
  }

  res.status(200).json({
    status: "success",
    data: {
      summary: {
        totalAlerts,
        activeAlerts,
        resolvedAlerts,
        resolutionRate: Number.parseFloat(resolutionRate),
        averageResolutionTime: Number.parseFloat(averageResolutionTime.toFixed(2)),
      },
      priorityBreakdown,
      typeBreakdown,
      dailyTrends,
      recommendations: [
        ...(activeAlerts > 10 ? ["High number of active alerts - consider prioritizing resolution"] : []),
        ...(Number.parseFloat(resolutionRate) < 70 ? ["Low resolution rate - review alert management process"] : []),
        ...(averageResolutionTime > 24
          ? ["High average resolution time - consider improving response procedures"]
          : []),
        ...(alerts.filter((a) => a.priority === "critical" && !a.resolved).length > 0
          ? [
              `${alerts.filter((a) => a.priority === "critical" && !a.resolved).length} critical alerts need immediate attention`,
            ]
          : []),
      ],
    },
  })
})

// @desc    Delete farm alert
// @route   DELETE /api/alerts/:alertId
// @access  Private
export const deleteFarmAlert = asyncHandler(async (req, res) => {
  const alert = await FarmAlert.findById(req.params.alertId)

  if (!alert) {
    throw new AppError("Alert not found", 404)
  }

  // Verify access through farm ownership
  const farm = await Farm.findOne({ _id: alert.farm, owner: req.user._id })
  if (!farm) {
    throw new AppError("Access denied", 403)
  }

  await alert.deleteOne()

  res.status(200).json({
    status: "success",
    message: "Alert deleted successfully",
  })
})
