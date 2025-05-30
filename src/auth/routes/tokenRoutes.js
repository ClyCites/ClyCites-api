import express from "express"
import {
  validateToken,
  quickValidateToken,
  getTokenInfo,
  validateTokenWithScopes,
  validateTokenForResource,
  checkTokenHealth,
  getTokenUsageStats,
} from "../controllers/tokenController.js"
import { protect } from "../middlewares/authMiddleware.js"
import { authenticateApiToken, requireScopes } from "../middlewares/apiTokenAuthMiddleware.js"
import {
  validateTokenValidation,
  quickValidateTokenValidation,
  tokenInfoValidation,
  tokenScopeValidation,
  tokenResourceValidation,
} from "../middlewares/tokenValidationMiddleware.js"
import {
  rateLimiter,
  tokenValidationRateLimit,
  quickValidationRateLimit,
  authRateLimit,
} from "../middlewares/rateLimitMiddleware.js"

const router = express.Router()

// ===== Public Token Validation Endpoints =====

/**
 * @route   POST /api/auth/validate-token
 * @desc    Validate token with full user data lookup
 * @access  Public
 */
router.post("/validate-token", tokenValidationRateLimit, validateTokenValidation, validateToken)

/**
 * @route   POST /api/auth/validate-token/quick
 * @desc    Quick token validation without user lookup
 * @access  Public
 */
router.post("/validate-token/quick", quickValidationRateLimit, quickValidateTokenValidation, quickValidateToken)

/**
 * @route   POST /api/auth/validate-token/scopes
 * @desc    Validate token with specific required scopes
 * @access  Public
 */
router.post("/validate-token/scopes", tokenValidationRateLimit, tokenScopeValidation, validateTokenWithScopes)

/**
 * @route   POST /api/auth/validate-token/resource
 * @desc    Validate token for specific resource and actions
 * @access  Public
 */
router.post("/validate-token/resource", tokenValidationRateLimit, tokenResourceValidation, validateTokenForResource)

// ===== Protected Token Information Endpoints =====

/**
 * @route   GET /api/auth/token-info
 * @desc    Get detailed token info (for debugging)
 * @access  Private (requires JWT auth)
 */
router.get("/token-info", authRateLimit, protect, tokenInfoValidation, getTokenInfo)

/**
 * @route   GET /api/auth/token-health
 * @desc    Check token health and validity
 * @access  Private (requires API token)
 */
router.get("/token-health", rateLimiter({ max: 50, windowMs: 5 * 60 * 1000 }), authenticateApiToken, checkTokenHealth)

/**
 * @route   GET /api/auth/token-usage
 * @desc    Get token usage statistics
 * @access  Private (requires API token with admin scope)
 */
router.get(
  "/token-usage",
  rateLimiter({ max: 20, windowMs: 5 * 60 * 1000 }),
  authenticateApiToken,
  requireScopes(["admin"]),
  getTokenUsageStats,
)

export default router
