import express from "express"
import { param, validationResult } from "express-validator"
import { Farm } from "../models/farm.model.js"
import { aiRecommendationService } from "../services/ai-recommendation.service.js"
import { extractUserInfo } from "../middleware/user.middleware.js"
import { logger } from "../utils/logger.js"

const router = express.Router()

// Apply user info extraction middleware
router.use(extractUserInfo)

// Get recommendations for a specific farm
router.get("/farm/:farmId", [param("farmId").isMongoId()], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Invalid farm ID",
      })
    }

    const farm = await Farm.findOne({
      _id: req.params.farmId,
      userId: req.user.userId,
      isActive: true,
    })

    if (!farm) {
      return res.status(404).json({
        success: false,
        message: "Farm not found",
      })
    }

    const recommendations = await aiRecommendationService.generateDailyRecommendations(farm)

    res.json({
      success: true,
      message: "Recommendations generated successfully",
      data: {
        farmId: farm._id,
        farmName: farm.name,
        generatedAt: new Date(),
        recommendations,
      },
    })
  } catch (error) {
    logger.error("Error generating recommendations:", error)
    res.status(500).json({
      success: false,
      message: "Failed to generate recommendations",
    })
  }
})

// Get recommendations for all user's farms
router.get("/all", async (req, res) => {
  try {
    const farms = await Farm.find({
      userId: req.user.userId,
      isActive: true,
    })

    const allRecommendations = []

    for (const farm of farms) {
      try {
        const recommendations = await aiRecommendationService.generateDailyRecommendations(farm)
        allRecommendations.push({
          farmId: farm._id,
          farmName: farm.name,
          recommendations,
        })
      } catch (error) {
        logger.error(`Error generating recommendations for farm ${farm._id}:`, error)
        // Continue with other farms even if one fails
      }
    }

    res.json({
      success: true,
      message: "Recommendations generated for all farms",
      data: {
        generatedAt: new Date(),
        farms: allRecommendations,
      },
    })
  } catch (error) {
    logger.error("Error generating recommendations for all farms:", error)
    res.status(500).json({
      success: false,
      message: "Failed to generate recommendations",
    })
  }
})

export default router
