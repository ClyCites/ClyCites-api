import express from "express"
import {
  getDashboardData,
  getInsights,
  getRecommendations,
  getCostAnalysis,
  getProductionAnalysis,
  getWeatherImpact,
  getResourceOptimization,
} from "../controllers/smartFarmController.js"
import { protect } from "../middlewares/authMiddleware.js"

const router = express.Router()

// Smart assistant routes
router.get("/farms/:farmId/dashboard", protect, getDashboardData)
router.get("/farms/:farmId/insights", protect, getInsights)
router.get("/farms/:farmId/recommendations", protect, getRecommendations)
router.get("/farms/:farmId/cost-analysis", protect, getCostAnalysis)
router.get("/farms/:farmId/production-analysis", protect, getProductionAnalysis)
router.get("/farms/:farmId/weather-impact", protect, getWeatherImpact)
router.get("/farms/:farmId/resource-optimization", protect, getResourceOptimization)

export default router
