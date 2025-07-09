import { smartFarmService } from "../services/smartFarmService.js"
import Farm from "../models/farmModel.js"
import OrganizationMember from "../models/organizationMemberModel.js"
import { asyncHandler } from "../utils/asyncHandler.js"
import { AppError } from "../utils/appError.js"

// @desc    Get comprehensive farm dashboard
// @route   GET /api/farms/:farmId/dashboard
// @access  Private (Farm owner or org member)
export const getFarmDashboard = asyncHandler(async (req, res, next) => {
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
    const dashboardData = await smartFarmService.getFarmDashboard(farmId, req.user.id)

    res.status(200).json({
      success: true,
      message: "Farm dashboard data retrieved successfully",
      data: dashboardData,
    })
  } catch (error) {
    return next(new AppError(`Failed to generate dashboard: ${error.message}`, 500))
  }
})

// @desc    Get smart action recommendations
// @route   GET /api/farms/:farmId/smart-actions
// @access  Private (Farm owner or org member)
export const getSmartActions = asyncHandler(async (req, res, next) => {
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
    const smartActions = await smartFarmService.getSmartActions(farmId, req.user.id)

    res.status(200).json({
      success: true,
      message: "Smart actions retrieved successfully",
      data: {
        actions: smartActions,
        count: smartActions.length,
        generatedAt: new Date(),
      },
    })
  } catch (error) {
    return next(new AppError(`Failed to generate smart actions: ${error.message}`, 500))
  }
})

// @desc    Generate comprehensive farm report
// @route   GET /api/farms/:farmId/report
// @access  Private (Farm owner or org member)
export const generateFarmReport = asyncHandler(async (req, res, next) => {
  const farmId = req.params.farmId
  const { period = "month" } = req.query

  // Validate period
  const validPeriods = ["week", "month", "quarter", "year"]
  if (!validPeriods.includes(period)) {
    return next(new AppError("Invalid period. Must be one of: week, month, quarter, year", 400))
  }

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
    const report = await smartFarmService.generateFarmReport(farmId, req.user.id, period)

    res.status(200).json({
      success: true,
      message: "Farm report generated successfully",
      data: report,
    })
  } catch (error) {
    return next(new AppError(`Failed to generate farm report: ${error.message}`, 500))
  }
})

// @desc    Get farm health score and metrics
// @route   GET /api/farms/:farmId/health
// @access  Private (Farm owner or org member)
export const getFarmHealth = asyncHandler(async (req, res, next) => {
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
    // Get basic dashboard data to calculate health
    const dashboardData = await smartFarmService.getFarmDashboard(farmId, req.user.id)

    const healthMetrics = {
      overallScore: dashboardData.farm.healthScore,
      breakdown: {
        cropHealth: {
          score: 85,
          factors: [
            { name: "Growth Stage Distribution", impact: 15, status: "good" },
            { name: "Disease Incidents", impact: -5, status: "minor_issues" },
            { name: "Harvest Timing", impact: 10, status: "optimal" },
          ],
        },
        livestockHealth: {
          score: 90,
          factors: [
            { name: "Production Efficiency", impact: 20, status: "excellent" },
            { name: "Health Issues", impact: -2, status: "minimal" },
            { name: "Vaccination Status", impact: 5, status: "up_to_date" },
          ],
        },
        taskManagement: {
          score: dashboardData.tasks.statistics.today.completionRate,
          factors: [
            {
              name: "Completion Rate",
              impact: dashboardData.tasks.statistics.today.completionRate - 70,
              status: "good",
            },
            { name: "Overdue Tasks", impact: -10, status: "needs_attention" },
          ],
        },
        weatherPreparedness: {
          score: 75,
          factors: [
            { name: "Alert Response", impact: 10, status: "good" },
            { name: "Seasonal Planning", impact: 15, status: "good" },
            { name: "Risk Mitigation", impact: -5, status: "minor_gaps" },
          ],
        },
      },
      trends: {
        lastWeek: dashboardData.farm.healthScore - 3,
        lastMonth: dashboardData.farm.healthScore - 8,
        direction: "improving",
      },
      recommendations: [
        "Focus on completing overdue irrigation tasks",
        "Schedule upcoming livestock vaccinations",
        "Prepare for harvest season logistics",
      ],
    }

    res.status(200).json({
      success: true,
      message: "Farm health metrics retrieved successfully",
      data: healthMetrics,
    })
  } catch (error) {
    return next(new AppError(`Failed to calculate farm health: ${error.message}`, 500))
  }
})

export default {
  getFarmDashboard,
  getSmartActions,
  generateFarmReport,
  getFarmHealth,
}
