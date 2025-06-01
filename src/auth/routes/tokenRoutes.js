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
import { authenticateApiToken, requireScopes } from "../middlewares/apiTokenAuthMiddleware.js"
import {
  validateTokenValidation,
  quickValidateTokenValidation,
  tokenInfoValidation,
  tokenScopeValidation,
  tokenResourceValidation,
} from "../middlewares/tokenValidationMiddleware.js"
import { rateLimiter, tokenValidationRateLimit, quickValidationRateLimit } from "../middlewares/rateLimitMiddleware.js"

const router = express.Router()

// ===== Public Token Validation Endpoints (No Auth Required) =====

/**
 * @route   POST /api/auth/validate-token
 * @desc    Validate any token (JWT or API token) - Public endpoint
 * @access  Public
 */
router.post("/validate-token", tokenValidationRateLimit, validateTokenValidation, validateToken)

/**
 * @route   POST /api/auth/validate-token/quick
 * @desc    Quick token validation without user lookup - Public endpoint
 * @access  Public
 */
router.post("/validate-token/quick", quickValidationRateLimit, quickValidateTokenValidation, quickValidateToken)

// ===== API Token Authenticated Validation Endpoints =====

/**
 * @route   POST /api/auth/validate-token/scopes
 * @desc    Validate token with specific required scopes (API token auth)
 * @access  Private (requires API token)
 */
router.post(
  "/validate-token/scopes",
  tokenValidationRateLimit,
  authenticateApiToken,
  tokenScopeValidation,
  validateTokenWithScopes,
)

/**
 * @route   POST /api/auth/validate-token/resource
 * @desc    Validate token for specific resource and actions (API token auth)
 * @access  Private (requires API token)
 */
router.post(
  "/validate-token/resource",
  tokenValidationRateLimit,
  authenticateApiToken,
  tokenResourceValidation,
  validateTokenForResource,
)

// ===== Token Information Endpoints =====

/**
 * @route   GET /api/auth/token-info
 * @desc    Get detailed token info (API token auth)
 * @access  Private (requires API token)
 */
router.get(
  "/token-info",
  rateLimiter({ max: 30, windowMs: 5 * 60 * 1000 }),
  authenticateApiToken,
  tokenInfoValidation,
  getTokenInfo,
)

/**
 * @route   GET /api/auth/token-health
 * @desc    Check token health and validity - API token auth required
 * @access  Private (requires API token)
 */
router.get("/token-health", rateLimiter({ max: 50, windowMs: 5 * 60 * 1000 }), authenticateApiToken, checkTokenHealth)

/**
 * @route   GET /api/auth/token-usage
 * @desc    Get token usage statistics - API token with admin scope required
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
