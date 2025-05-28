import express from "express"
import { validateToken, getTokenInfo } from "../controllers/tokenController.js"
import { protect } from "../middlewares/authMiddleware.js"

const router = express.Router()

// Public token validation endpoint
router.post("/validate-token", validateToken)

// Protected token info endpoint
router.get("/token-info", protect, getTokenInfo)

export default router
