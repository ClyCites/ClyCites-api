import express from "express"
import { getDashboardData, getInsights, getRecommendations, getFarmHealth } from "../controllers/smartFarmController.js"
import { protect } from "../middlewares/authMiddleware.js"

const router = express.Router()

// Smart assistant routes
router.get("/farms/:farmId/dashboard", protect, getDashboardData)
router.get("/farms/:farmId/insights", protect, getInsights)
router.get("/farms/:farmId/recommendations", protect, getRecommendations)
router.get("/farms/:farmId/health", protect, getFarmHealth)

export default router
