import { validationResult } from "express-validator"
import { dailyAssistantService } from "../services/dailyAssistantService.js"
import DailyTask from "../models/dailyTaskModel.js"
import WeatherAlert from "../models/weatherAlertModel.js"
import Farm from "../models/farmModel.js"
import OrganizationMember from "../models/organizationMemberModel.js"
import { asyncHandler } from "../utils/asyncHandler.js"
import { AppError } from "../utils/appError.js"

// @desc    Get daily summary for a farm
// @route   GET /api/farms/:farmId/daily-summary
// @access  Private (Farm owner or org member)
export const getDailySummary = asyncHandler(async (req, res, next) => {
  const farmId = req.params.farmId
  const date = req.query.date ? new Date(req.query.date) : new Date()

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
    const dailySummary = await dailyAssistantService.generateDailySummary(farmId, req.user.id, date)

    res.status(200).json({
      success: true,
      message: "Daily summary generated successfully",
      data: dailySummary,
    })
  } catch (error) {
    return next(new AppError(`Failed to generate daily summary: ${error.message}`, 500))
  }
})

// @desc    Get tasks for a specific date
// @route   GET /api/farms/:farmId/tasks
// @access  Private (Farm owner or org member)
export const getFarmTasks = asyncHandler(async (req, res, next) => {
  const farmId = req.params.farmId
  const date = req.query.date ? new Date(req.query.date) : new Date()
  const status = req.query.status

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
    let tasks
    if (status) {
      const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate())
      const endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1)

      tasks = await DailyTask.find({
        farm: farmId,
        user: req.user.id,
        status,
        taskDate: {
          $gte: startOfDay,
          $lt: endOfDay,
        },
      })
        .populate("crop", "name category growthStage")
        .populate("livestock", "herdName animalType totalAnimals")
        .sort({ priority: -1, urgencyScore: -1 })
    } else {
      tasks = await dailyAssistantService.getTasksForDate(farmId, req.user.id, date)
    }

    // Add calculated fields
    const tasksWithCalculations = tasks.map((task) => ({
      ...task.toObject(),
      isOverdue: task.isOverdue,
      daysOverdue: task.daysOverdue,
      urgencyScore: task.urgencyScore,
    }))

    res.status(200).json({
      success: true,
      data: {
        tasks: tasksWithCalculations,
        count: tasks.length,
        date: date.toISOString().split("T")[0],
      },
    })
  } catch (error) {
    return next(new AppError(`Failed to fetch tasks: ${error.message}`, 500))
  }
})

// @desc    Update task status
// @route   PUT /api/tasks/:taskId/status
// @access  Private (Task owner)
export const updateTaskStatus = asyncHandler(async (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return next(new AppError("Validation failed", 400, errors.array()))
  }

  const taskId = req.params.taskId
  const { status, completionData } = req.body

  try {
    const task = await dailyAssistantService.updateTaskStatus(taskId, req.user.id, status, completionData)

    res.status(200).json({
      success: true,
      message: "Task status updated successfully",
      data: { task },
    })
  } catch (error) {
    return next(new AppError(error.message, 400))
  }
})

// @desc    Create custom task
// @route   POST /api/farms/:farmId/tasks
// @access  Private (Farm owner or org member)
export const createCustomTask = asyncHandler(async (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return next(new AppError("Validation failed", 400, errors.array()))
  }

  const farmId = req.params.farmId
  const {
    title,
    description,
    category,
    priority,
    taskDate,
    estimatedDuration,
    crop,
    livestock,
    weatherDependent,
    weatherConditions,
    resources,
    instructions,
    reminders,
  } = req.body

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
    const task = await DailyTask.create({
      farm: farmId,
      user: req.user.id,
      crop,
      livestock,
      taskDate: new Date(taskDate),
      category,
      title,
      description,
      priority,
      estimatedDuration,
      weatherDependent,
      weatherConditions,
      resources,
      instructions,
      reminders,
      aiGenerated: false,
    })

    res.status(201).json({
      success: true,
      message: "Custom task created successfully",
      data: { task },
    })
  } catch (error) {
    return next(new AppError(`Failed to create task: ${error.message}`, 500))
  }
})

// @desc    Get active weather alerts
// @route   GET /api/farms/:farmId/alerts
// @access  Private (Farm owner or org member)
export const getWeatherAlerts = asyncHandler(async (req, res, next) => {
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

  try {
    const alerts = await WeatherAlert.find({
      farm: farmId,
      isActive: true,
      validUntil: { $gte: new Date() },
    })
      .populate("affectedCrops", "name category")
      .populate("affectedLivestock", "herdName animalType")
      .sort({ severity: -1, createdAt: -1 })

    // Add calculated fields
    const alertsWithCalculations = alerts.map((alert) => ({
      ...alert.toObject(),
      timeRemaining: alert.timeRemaining,
      isExpired: alert.isExpired,
    }))

    res.status(200).json({
      success: true,
      data: {
        alerts: alertsWithCalculations,
        count: alerts.length,
      },
    })
  } catch (error) {
    return next(new AppError(`Failed to fetch alerts: ${error.message}`, 500))
  }
})

// @desc    Acknowledge weather alert
// @route   PUT /api/alerts/:alertId/acknowledge
// @access  Private (Alert recipient)
export const acknowledgeAlert = asyncHandler(async (req, res, next) => {
  const alertId = req.params.alertId

  try {
    const alert = await WeatherAlert.findOne({
      _id: alertId,
      user: req.user.id,
    })

    if (!alert) {
      return next(new AppError("Alert not found", 404))
    }

    alert.acknowledged = {
      acknowledgedAt: new Date(),
      acknowledgedBy: req.user.id,
    }

    await alert.save()

    res.status(200).json({
      success: true,
      message: "Alert acknowledged successfully",
      data: { alert },
    })
  } catch (error) {
    return next(new AppError(`Failed to acknowledge alert: ${error.message}`, 500))
  }
})

// @desc    Get task statistics
// @route   GET /api/farms/:farmId/task-stats
// @access  Private (Farm owner or org member)
export const getTaskStatistics = asyncHandler(async (req, res, next) => {
  const farmId = req.params.farmId
  const period = req.query.period || "week" // week, month, year

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
        startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000)
    }

    const [totalTasks, completedTasks, pendingTasks, overdueTasks, tasksByCategory, tasksByPriority] =
      await Promise.all([
        DailyTask.countDocuments({
          farm: farmId,
          user: req.user.id,
          taskDate: { $gte: startDate, $lte: endDate },
        }),
        DailyTask.countDocuments({
          farm: farmId,
          user: req.user.id,
          status: "completed",
          taskDate: { $gte: startDate, $lte: endDate },
        }),
        DailyTask.countDocuments({
          farm: farmId,
          user: req.user.id,
          status: "pending",
          taskDate: { $gte: startDate, $lte: endDate },
        }),
        DailyTask.countDocuments({
          farm: farmId,
          user: req.user.id,
          status: "pending",
          taskDate: { $lt: new Date() },
        }),
        DailyTask.aggregate([
          {
            $match: {
              farm: farmId,
              user: req.user.id,
              taskDate: { $gte: startDate, $lte: endDate },
            },
          },
          {
            $group: {
              _id: "$category",
              count: { $sum: 1 },
            },
          },
        ]),
        DailyTask.aggregate([
          {
            $match: {
              farm: farmId,
              user: req.user.id,
              taskDate: { $gte: startDate, $lte: endDate },
            },
          },
          {
            $group: {
              _id: "$priority",
              count: { $sum: 1 },
            },
          },
        ]),
      ])

    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

    res.status(200).json({
      success: true,
      data: {
        period,
        startDate,
        endDate,
        summary: {
          totalTasks,
          completedTasks,
          pendingTasks,
          overdueTasks,
          completionRate,
        },
        breakdown: {
          byCategory: tasksByCategory,
          byPriority: tasksByPriority,
        },
      },
    })
  } catch (error) {
    return next(new AppError(`Failed to fetch task statistics: ${error.message}`, 500))
  }
})

export default {
  getDailySummary,
  getFarmTasks,
  updateTaskStatus,
  createCustomTask,
  getWeatherAlerts,
  acknowledgeAlert,
  getTaskStatistics,
}
