import express from "express"
import { validateToken, getTokenInfo, quickValidateToken } from "../controllers/tokenController.js"
import { protect } from "../middlewares/authMiddleware.js"

const router = express.Router()

// Public token validation endpoint (full validation with user data)
router.post("/validate-token", validateToken)

// Quick token validation (just checks if token is valid, no user lookup)
router.post("/validate-token/quick", quickValidateToken)

// Protected token info endpoint (for debugging)
router.get("/token-info", protect, getTokenInfo)

export default router
