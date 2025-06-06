import express from "express"
import { getAIStatus, testAIService } from "../controllers/aiStatusController.js"
import { authMiddleware } from "../middlewares/authMiddleware.js"

const router = express.Router()

// Public endpoint to check AI service status
router.get("/ai/status", getAIStatus)

// Protected endpoint to test AI service (requires authentication)
router.post("/ai/test", authMiddleware, testAIService)

export default router
