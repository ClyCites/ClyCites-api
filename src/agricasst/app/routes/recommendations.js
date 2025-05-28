import express from "express"
import {
  getCropRecommendations,
  getIrrigationRecommendations,
  getPlantingRecommendations,
  getFertilizerRecommendations,
  getPestManagementRecommendations,
} from "../controllers/recommendationController.js"
import { validateCoordinates } from "../middleware/validation.js"

const router = express.Router()

// Get crop recommendations
router.get("/crops", validateCoordinates, getCropRecommendations)

// Get irrigation recommendations
router.get("/irrigation", validateCoordinates, getIrrigationRecommendations)

// Get planting recommendations
router.get("/planting", validateCoordinates, getPlantingRecommendations)

// Get fertilizer recommendations
router.get("/fertilizer", getFertilizerRecommendations)

// Get pest management recommendations
router.get("/pest-management", validateCoordinates, getPestManagementRecommendations)

export default router
