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
  const activeAlerts = alerts.filter((alert) => !alert.resolved).length
  const criticalAlerts = alerts.filter((alert) => alert.priority === "critical" && !alert.resolved).length
  const resolvedToday = alerts.filter((alert) => {
    if (!alert.resolved || !alert.resolvedAt) return false
    const today = new Date()
    const resolvedDate = new Date(alert.resolvedAt)
    return resolvedDate.toDateString() === today.toDateString()
  }).length

  res.status(200).json({
    status: "success",
    results: alerts.length,
    data: {
      alerts,
      summary: {
        totalAlerts: alerts.length,
        activeAlerts,
        criticalAlerts,
        resolvedToday,
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
    .populate("createdBy", "firstName lastName email")
    .populate("resolvedBy", "firstName lastName email")

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
  await alert.populate("resolvedBy", "firstName lastName")

  res.status(200).json({
    status: "success",
    data: { alert },
  })
})

// @desc    Resolve farm alert
// @route   POST /api/alerts/:alertId/resolve
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

  if (alert.resolved) {
    throw new AppError("Alert is already resolved", 400)
  }

  // Resolve alert
  alert.resolved = true
  alert.resolvedAt = new Date()
  alert.resolvedBy = req.user._id
  alert.resolution = resolution
  alert.resolutionNotes = notes
  alert.status = "resolved"
  alert.lastUpdated = new Date()

  await alert.save()
  await alert.populate("resolvedBy", "firstName lastName")

  res.status(200).json({
    status: "success",
    message: "Alert resolved successfully",
    data: { alert },
  })
})

// @desc    Escalate farm alert
// @route   POST /api/alerts/:alertId/escalate
// @access  Private
export const escalateFarmAlert = asyncHandler(async (req, res) => {
  const { escalationReason, newPriority } = req.body
  const alert = await FarmAlert.findById(req.params.alertId)

  if (!alert) {
    throw new AppError("Alert not found", 404)
  }

  // Verify access through farm ownership
  const farm = await Farm.findOne({ _id: alert.farm, owner: req.user._id })
  if (!farm) {
    throw new AppError("Access denied", 403)
  }

  if (alert.resolved) {
    throw new AppError("Cannot escalate resolved alert", 400)
  }

  // Add escalation record
  alert.escalations.push({
    escalatedAt: new Date(),
    escalatedBy: req.user._id,
    previousPriority: alert.priority,
    newPriority: newPriority || "critical",
    reason: escalationReason,
  })

  // Update priority if provided
  if (newPriority) {
    alert.priority = newPriority
  }

  alert.status = "escalated"
  alert.lastUpdated = new Date()

  await alert.save()

  res.status(200).json({
    status: "success",
    message: "Alert escalated successfully",
    data: { alert },
  })
})

// @desc    Add comment to alert
// @route   POST /api/alerts/:alertId/comments
// @access  Private
export const addAlertComment = asyncHandler(async (req, res) => {
  const { comment } = req.body
  const alert = await FarmAlert.findById(req.params.alertId)

  if (!alert) {
    throw new AppError("Alert not found", 404)
  }

  // Verify access through farm ownership
  const farm = await Farm.findOne({ _id: alert.farm, owner: req.user._id })
  if (!farm) {
    throw new AppError("Access denied", 403)
  }

  // Add comment
  alert.comments.push({
    comment,
    commentedBy: req.user._id,
    commentedAt: new Date(),
  })

  alert.lastUpdated = new Date()
  await alert.save()

  res.status(200).json({
    status: "success",
    message: "Comment added successfully",
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

  const alerts = await FarmAlert.find({ farm: farmId })

  // Calculate analytics
  const totalAlerts = alerts.length
  const activeAlerts = alerts.filter((alert) => !alert.resolved).length
  const resolvedAlerts = alerts.filter((alert) => alert.resolved).length

  // Priority breakdown
  const priorityBreakdown = alerts.reduce((acc, alert) => {
    if (!acc[alert.priority]) {
      acc[alert.priority] = { total: 0, active: 0, resolved: 0 }
    }
    acc[alert.priority].total++
    if (alert.resolved) {
      acc[alert.priority].resolved++
    } else {
      acc[alert.priority].active++
    }
    return acc
  }, {})

  // Type breakdown
  const typeBreakdown = alerts.reduce((acc, alert) => {
    if (!acc[alert.type]) {
      acc[alert.type] = { total: 0, active: 0, resolved: 0 }
    }
    acc[alert.type].total++
    if (alert.resolved) {
      acc[alert.type].resolved++
    } else {
      acc[alert.type].active++
    }
    return acc
  }, {})

  // Resolution time analysis
  const resolvedAlertsWithTime = alerts.filter((alert) => alert.resolved && alert.resolvedAt && alert.createdAt)

  const avgResolutionTime =
    resolvedAlertsWithTime.length > 0
      ? resolvedAlertsWithTime.reduce((sum, alert) => {
          const resolutionTime = new Date(alert.resolvedAt) - new Date(alert.createdAt)
          return sum + resolutionTime
        }, 0) / resolvedAlertsWithTime.length
      : 0

  // Trend analysis (last 30 days)
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - Number.parseInt(period))

  const recentAlerts = alerts.filter((alert) => new Date(alert.createdAt) >= thirtyDaysAgo)
  const dailyTrends = {}

  recentAlerts.forEach((alert) => {
    const date = new Date(alert.createdAt).toDateString()
    if (!dailyTrends[date]) {
      dailyTrends[date] = { created: 0, resolved: 0 }
    }
    dailyTrends[date].created++

    if (alert.resolved && new Date(alert.resolvedAt) >= thirtyDaysAgo) {
      const resolvedDate = new Date(alert.resolvedAt).toDateString()
      if (!dailyTrends[resolvedDate]) {
        dailyTrends[resolvedDate] = { created: 0, resolved: 0 }
      }
      dailyTrends[resolvedDate].resolved++
    }
  })

  res.status(200).json({
    status: "success",
    data: {
      summary: {
        totalAlerts,
        activeAlerts,
        resolvedAlerts,
        resolutionRate: totalAlerts > 0 ? ((resolvedAlerts / totalAlerts) * 100).toFixed(2) : 0,
        avgResolutionTimeHours: avgResolutionTime > 0 ? (avgResolutionTime / (1000 * 60 * 60)).toFixed(2) : 0,
      },
      priorityBreakdown,
      typeBreakdown,
      dailyTrends,
      recommendations: [
        ...(activeAlerts > 10 ? ["High number of active alerts - consider prioritization"] : []),
        ...(priorityBreakdown.critical?.active > 0
          ? [`${priorityBreakdown.critical.active} critical alerts need immediate attention`]
          : []),
        ...(avgResolutionTime > 24 * 60 * 60 * 1000 ? ["Average resolution time exceeds 24 hours"] : []),
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
