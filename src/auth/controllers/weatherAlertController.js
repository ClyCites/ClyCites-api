import { validationResult } from "express-validator"
import { weatherAlertService } from "../services/weatherAlertService.js"
import WeatherAlert from "../models/weatherAlertModel.js"
import Farm from "../models/farmModel.js"
import OrganizationMember from "../models/organizationMemberModel.js"
import { asyncHandler } from "../utils/asyncHandler.js"
import { AppError } from "../utils/appError.js"

// @desc    Get weather alerts for a farm
// @route   GET /api/farms/:farmId/weather-alerts
// @access  Private (Farm owner or org member)
export const getWeatherAlerts = asyncHandler(async (req, res, next) => {
  const farmId = req.params.farmId
  const { isActive, severity, alertType, limit = 50 } = req.query

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

  try {
    const options = {
      isActive: isActive !== undefined ? isActive === "true" : true,
      validUntil: true, // Only get non-expired alerts
    }

    if (severity) options.severity = severity
    if (alertType) options.alertType = alertType

    const alerts = await weatherAlertService.getAlertsByFarm(farmId, options)

    // Add calculated fields
    const alertsWithCalculations = alerts.slice(0, Number.parseInt(limit)).map((alert) => ({
      ...alert.toObject(),
      timeRemaining: alert.timeRemaining,
      isExpired: alert.isExpired,
    }))

    res.status(200).json({
      success: true,
      data: {
        alerts: alertsWithCalculations,
        count: alertsWithCalculations.length,
        total: alerts.length,
      },
    })
  } catch (error) {
    return next(new AppError(`Failed to fetch weather alerts: ${error.message}`, 500))
  }
})

// @desc    Get specific weather alert
// @route   GET /api/weather-alerts/:alertId
// @access  Private (Alert recipient or farm member)
export const getWeatherAlert = asyncHandler(async (req, res, next) => {
  const alertId = req.params.alertId

  try {
    const alert = await WeatherAlert.findById(alertId)
      .populate("farm", "name location")
      .populate("user", "name email")
      .populate("affectedCrops", "name category growthStage")
      .populate("affectedLivestock", "herdName animalType totalAnimals")
      .populate("relatedTasks", "title status priority taskDate")

    if (!alert) {
      return next(new AppError("Weather alert not found", 404))
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

    // Add calculated fields
    const alertWithCalculations = {
      ...alert.toObject(),
      timeRemaining: alert.timeRemaining,
      isExpired: alert.isExpired,
    }

    res.status(200).json({
      success: true,
      data: { alert: alertWithCalculations },
    })
  } catch (error) {
    return next(new AppError(`Failed to fetch weather alert: ${error.message}`, 500))
  }
})

// @desc    Acknowledge weather alert
// @route   PUT /api/weather-alerts/:alertId/acknowledge
// @access  Private (Alert recipient)
export const acknowledgeWeatherAlert = asyncHandler(async (req, res, next) => {
  const alertId = req.params.alertId

  try {
    const alert = await WeatherAlert.findOne({
      _id: alertId,
      user: req.user.id,
    })

    if (!alert) {
      return next(new AppError("Weather alert not found or access denied", 404))
    }

    if (alert.acknowledged.acknowledgedAt) {
      return next(new AppError("Alert already acknowledged", 400))
    }

    await alert.acknowledge(req.user.id)

    res.status(200).json({
      success: true,
      message: "Weather alert acknowledged successfully",
      data: { alert },
    })
  } catch (error) {
    return next(new AppError(`Failed to acknowledge alert: ${error.message}`, 500))
  }
})

// @desc    Implement alert action
// @route   POST /api/weather-alerts/:alertId/implement-action
// @access  Private (Alert recipient)
export const implementAlertAction = asyncHandler(async (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return next(new AppError("Validation failed", 400, errors.array()))
  }

  const alertId = req.params.alertId
  const { action, cost, effectiveness, notes } = req.body

  try {
    const alert = await WeatherAlert.findOne({
      _id: alertId,
      user: req.user.id,
    })

    if (!alert) {
      return next(new AppError("Weather alert not found or access denied", 404))
    }

    const actionData = {
      action,
      cost: Number.parseFloat(cost) || 0,
      effectiveness: Number.parseInt(effectiveness) || 3,
      notes: notes || "",
    }

    await alert.implementAction(actionData, req.user.id)

    res.status(200).json({
      success: true,
      message: "Alert action implemented successfully",
      data: { alert },
    })
  } catch (error) {
    return next(new AppError(`Failed to implement action: ${error.message}`, 500))
  }
})

// @desc    Create tasks from alert recommendations
// @route   POST /api/weather-alerts/:alertId/create-tasks
// @access  Private (Alert recipient)
export const createTasksFromAlert = asyncHandler(async (req, res, next) => {
  const alertId = req.params.alertId
  const { selectedActions } = req.body

  try {
    const alert = await WeatherAlert.findOne({
      _id: alertId,
      user: req.user.id,
    })

    if (!alert) {
      return next(new AppError("Weather alert not found or access denied", 404))
    }

    const tasks = await weatherAlertService.createTasksFromAlert(alertId, req.user.id, selectedActions)

    res.status(201).json({
      success: true,
      message: "Tasks created from alert recommendations",
      data: { tasks, count: tasks.length },
    })
  } catch (error) {
    return next(new AppError(`Failed to create tasks: ${error.message}`, 500))
  }
})

// @desc    Get alert statistics
// @route   GET /api/farms/:farmId/weather-alerts/stats
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

  try {
    let startDate
    const endDate = new Date()

    switch (period) {
      case "week":
        startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case "month":
        startDate = new Date(endDate.getFullYear(), endDate.getMonth() - 1, endDate.getDate())
        break
      case "year":
        startDate = new Date(endDate.getFullYear() - 1, endDate.getMonth(), endDate.getDate())
        break
      default:
        startDate = new Date(endDate.getFullYear(), endDate.getMonth() - 1, endDate.getDate())
    }

    const [
      totalAlerts,
      activeAlerts,
      acknowledgedAlerts,
      alertsBySeverity,
      alertsByType,
      actionsImplemented,
      tasksCreated,
    ] = await Promise.all([
      WeatherAlert.countDocuments({
        farm: farmId,
        createdAt: { $gte: startDate, $lte: endDate },
      }),
      WeatherAlert.countDocuments({
        farm: farmId,
        isActive: true,
        validUntil: { $gte: new Date() },
      }),
      WeatherAlert.countDocuments({
        farm: farmId,
        "acknowledged.acknowledgedAt": { $exists: true },
        createdAt: { $gte: startDate, $lte: endDate },
      }),
      WeatherAlert.aggregate([
        {
          $match: {
            farm: farmId,
            createdAt: { $gte: startDate, $lte: endDate },
          },
        },
        {
          $group: {
            _id: "$severity",
            count: { $sum: 1 },
          },
        },
      ]),
      WeatherAlert.aggregate([
        {
          $match: {
            farm: farmId,
            createdAt: { $gte: startDate, $lte: endDate },
          },
        },
        {
          $group: {
            _id: "$alertType",
            count: { $sum: 1 },
          },
        },
      ]),
      WeatherAlert.aggregate([
        {
          $match: {
            farm: farmId,
            createdAt: { $gte: startDate, $lte: endDate },
          },
        },
        {
          $project: {
            actionsCount: { $size: "$actionsImplemented" },
          },
        },
        {
          $group: {
            _id: null,
            totalActions: { $sum: "$actionsCount" },
          },
        },
      ]),
      WeatherAlert.aggregate([
        {
          $match: {
            farm: farmId,
            createdAt: { $gte: startDate, $lte: endDate },
          },
        },
        {
          $project: {
            tasksCount: { $size: "$relatedTasks" },
          },
        },
        {
          $group: {
            _id: null,
            totalTasks: { $sum: "$tasksCount" },
          },
        },
      ]),
    ])

    const acknowledgmentRate = totalAlerts > 0 ? Math.round((acknowledgedAlerts / totalAlerts) * 100) : 0

    res.status(200).json({
      success: true,
      data: {
        period,
        startDate,
        endDate,
        summary: {
          totalAlerts,
          activeAlerts,
          acknowledgedAlerts,
          acknowledgmentRate,
          actionsImplemented: actionsImplemented[0]?.totalActions || 0,
          tasksCreated: tasksCreated[0]?.totalTasks || 0,
        },
        breakdown: {
          bySeverity: alertsBySeverity,
          byType: alertsByType,
        },
      },
    })
  } catch (error) {
    return next(new AppError(`Failed to fetch alert statistics: ${error.message}`, 500))
  }
})

// @desc    Expire old alerts (Admin/System function)
// @route   POST /api/weather-alerts/expire-old
// @access  Private (System/Admin)
export const expireOldAlerts = asyncHandler(async (req, res, next) => {
  try {
    const result = await weatherAlertService.expireOldAlerts()

    res.status(200).json({
      success: true,
      message: `Expired ${result.modifiedCount} old weather alerts`,
      data: { expiredCount: result.modifiedCount },
    })
  } catch (error) {
    return next(new AppError(`Failed to expire old alerts: ${error.message}`, 500))
  }
})

export default {
  getWeatherAlerts,
  getWeatherAlert,
  acknowledgeWeatherAlert,
  implementAlertAction,
  createTasksFromAlert,
  getAlertStatistics,
  expireOldAlerts,
}
