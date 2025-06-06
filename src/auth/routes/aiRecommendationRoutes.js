import express from "express"
import { query, body } from "express-validator"
import { protect } from "../middlewares/authMiddleware.js"
import { aiRecommendationService } from "../services/aiRecommendationService.js"
import { asyncHandler } from "../utils/asyncHandler.js"
import { AppError } from "../utils/appError.js"

const router = express.Router()

// All routes require authentication
router.use(protect)

// @desc    Get active recommendations for user
// @route   GET /api/recommendations
// @access  Private
router.get(
  "/",
  [
    query("farmId").optional().isMongoId().withMessage("Valid farm ID required"),
    query("type")
      .optional()
      .isIn([
        "irrigation",
        "fertilization",
        "pest_management",
        "disease_prevention",
        "harvest_timing",
        "planting_schedule",
        "weather_alert",
        "market_advisory",
        "soil_management",
        "general",
      ])
      .withMessage("Invalid recommendation type"),
    query("priority").optional().isIn(["low", "medium", "high", "critical"]).withMessage("Invalid priority level"),
    query("limit").optional().isInt({ min: 1, max: 100 }).withMessage("Limit must be between 1 and 100"),
  ],
  asyncHandler(async (req, res, next) => {
    const { farmId, type, priority, limit } = req.query

    const filters = {
      type,
      priority,
      limit: limit ? Number.parseInt(limit) : 50,
    }

    try {
      let recommendations
      if (farmId) {
        recommendations = await aiRecommendationService.getActiveRecommendations(farmId, req.user.id, filters)
      } else {
        // Get recommendations for all user's farms
        const Farm = (await import("../models/farmModel.js")).default
        const userFarms = await Farm.find({ owner: req.user.id, isActive: true })

        recommendations = []
        for (const farm of userFarms) {
          const farmRecs = await aiRecommendationService.getActiveRecommendations(farm._id, req.user.id, filters)
          recommendations.push(...farmRecs)
        }

        // Sort by priority and date
        recommendations.sort((a, b) => {
          const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 }
          if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
            return priorityOrder[b.priority] - priorityOrder[a.priority]
          }
          return new Date(b.createdAt) - new Date(a.createdAt)
        })

        recommendations = recommendations.slice(0, filters.limit)
      }

      res.status(200).json({
        success: true,
        data: {
          recommendations,
          count: recommendations.length,
        },
      })
    } catch (error) {
      return next(new AppError(`Failed to fetch recommendations: ${error.message}`, 500))
    }
  }),
)

// @desc    Update recommendation status
// @route   PUT /api/recommendations/:recommendationId
// @access  Private
router.put(
  "/:recommendationId",
  [
    body("status")
      .isIn(["active", "acknowledged", "implemented", "dismissed", "expired"])
      .withMessage("Invalid status"),
    body("feedback.rating").optional().isInt({ min: 1, max: 5 }).withMessage("Rating must be between 1 and 5"),
    body("feedback.helpful").optional().isBoolean().withMessage("Helpful must be a boolean"),
    body("feedback.comments").optional().isString().withMessage("Comments must be a string"),
    body("feedback.implementationResult").optional().isString().withMessage("Implementation result must be a string"),
  ],
  asyncHandler(async (req, res, next) => {
    const { recommendationId } = req.params
    const { status, feedback } = req.body

    try {
      const recommendation = await aiRecommendationService.updateRecommendationStatus(
        recommendationId,
        req.user.id,
        status,
        feedback,
      )

      res.status(200).json({
        success: true,
        message: "Recommendation updated successfully",
        data: { recommendation },
      })
    } catch (error) {
      return next(new AppError(`Failed to update recommendation: ${error.message}`, 500))
    }
  }),
)

// @desc    Generate recommendations for a specific farm
// @route   POST /api/recommendations/generate/:farmId
// @access  Private
router.post(
  "/generate/:farmId",
  asyncHandler(async (req, res, next) => {
    const { farmId } = req.params

    try {
      const recommendations = await aiRecommendationService.generateFarmRecommendations(farmId, req.user.id)

      res.status(200).json({
        success: true,
        message: "Recommendations generated successfully",
        data: {
          recommendations,
          count: recommendations.length,
        },
      })
    } catch (error) {
      return next(new AppError(`Failed to generate recommendations: ${error.message}`, 500))
    }
  }),
)

export default router
