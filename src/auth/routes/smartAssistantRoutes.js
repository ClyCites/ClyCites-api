import express from "express"
import { param, query } from "express-validator"
import { smartAssistantService } from "../services/smartAssistantService.js"
import Farm from "../models/farmModel.js"
import OrganizationMember from "../models/organizationMemberModel.js"
import { protect } from "../middlewares/authMiddleware.js"
import { asyncHandler } from "../utils/asyncHandler.js"
import { AppError } from "../utils/appError.js"

const router = express.Router()

// All routes are protected
router.use(protect)

// @desc    Get comprehensive farm dashboard
// @route   GET /api/smart-assistant/farms/:farmId/dashboard
// @access  Private (Farm owner or org member)
router.get(
  "/farms/:farmId/dashboard",
  [param("farmId").isMongoId().withMessage("Invalid farm ID")],
  asyncHandler(async (req, res, next) => {
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

    const dashboardData = await smartAssistantService.generateFarmDashboard(farmId, req.user.id)

    res.status(200).json({
      success: true,
      message: "Farm dashboard data retrieved successfully",
      data: dashboardData,
    })
  }),
)

// @desc    Get AI insights for farm
// @route   GET /api/smart-assistant/farms/:farmId/insights
// @access  Private (Farm owner or org member)
router.get(
  "/farms/:farmId/insights",
  [param("farmId").isMongoId().withMessage("Invalid farm ID")],
  asyncHandler(async (req, res, next) => {
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

    const dashboardData = await smartAssistantService.generateFarmDashboard(farmId, req.user.id)

    res.status(200).json({
      success: true,
      message: "AI insights retrieved successfully",
      data: {
        insights: dashboardData.insights,
        recommendations: dashboardData.recommendations,
        generatedAt: new Date(),
      },
    })
  }),
)

// @desc    Get farm analytics
// @route   GET /api/smart-assistant/farms/:farmId/analytics
// @access  Private (Farm owner or org member)
router.get(
  "/farms/:farmId/analytics",
  [
    param("farmId").isMongoId().withMessage("Invalid farm ID"),
    query("period").optional().isIn(["week", "month", "quarter", "year"]).withMessage("Invalid period"),
  ],
  asyncHandler(async (req, res, next) => {
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

    const dashboardData = await smartAssistantService.generateFarmDashboard(farmId, req.user.id)

    res.status(200).json({
      success: true,
      message: "Farm analytics retrieved successfully",
      data: {
        analytics: dashboardData.analytics,
        period,
        generatedAt: new Date(),
      },
    })
  }),
)

export default router
