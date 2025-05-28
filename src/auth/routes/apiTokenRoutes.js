import express from "express"
import { body, param } from "express-validator"
import {
  createApiToken,
  getUserApiTokens,
  getApiTokenDetails,
  updateApiToken,
  revokeApiToken,
  regenerateApiToken,
  testApiToken,
} from "../controllers/apiTokenController.js"
import { protect } from "../middlewares/authMiddleware.js"

const router = express.Router()

// Validation rules
const tokenValidation = [
  body("name").trim().isLength({ min: 2, max: 100 }).withMessage("Token name must be between 2 and 100 characters"),
  body("description").optional().isLength({ max: 500 }).withMessage("Description cannot exceed 500 characters"),
  body("scopes")
    .isArray({ min: 1 })
    .withMessage("At least one scope is required")
    .custom((scopes) => {
      const validScopes = [
        "profile",
        "email",
        "organizations",
        "teams",
        "users",
        "roles",
        "permissions",
        "applications",
        "analytics",
        "billing",
        "admin",
        "read",
        "write",
        "delete",
        "manage",
        "invite",
        "export",
        "import",
      ]
      const invalidScopes = scopes.filter((scope) => !validScopes.includes(scope))
      if (invalidScopes.length > 0) {
        throw new Error(`Invalid scopes: ${invalidScopes.join(", ")}`)
      }
      return true
    }),
  body("permissions").optional().isArray().withMessage("Permissions must be an array"),
  body("applicationId").optional().isMongoId().withMessage("Please provide a valid application ID"),
  body("expiresAt")
    .optional()
    .isISO8601()
    .withMessage("Please provide a valid expiration date")
    .custom((value) => {
      if (new Date(value) <= new Date()) {
        throw new Error("Expiration date must be in the future")
      }
      return true
    }),
  body("rateLimits").optional().isObject().withMessage("Rate limits must be an object"),
  body("rateLimits.requestsPerMinute")
    .optional()
    .isInt({ min: 1, max: 10000 })
    .withMessage("Requests per minute must be between 1 and 10000"),
  body("rateLimits.requestsPerHour")
    .optional()
    .isInt({ min: 1, max: 100000 })
    .withMessage("Requests per hour must be between 1 and 100000"),
  body("rateLimits.requestsPerDay")
    .optional()
    .isInt({ min: 1, max: 1000000 })
    .withMessage("Requests per day must be between 1 and 1000000"),
]

const updateTokenValidation = [
  body("name")
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Token name must be between 2 and 100 characters"),
  body("description").optional().isLength({ max: 500 }).withMessage("Description cannot exceed 500 characters"),
  body("isActive").optional().isBoolean().withMessage("isActive must be a boolean"),
]

const tokenIdValidation = [param("tokenId").isMongoId().withMessage("Please provide a valid token ID")]

// All routes require authentication
router.use(protect)

// Organization API token routes
router.route("/organizations/:orgId/tokens").get(getUserApiTokens).post(tokenValidation, createApiToken)

// Individual token routes
router
  .route("/tokens/:tokenId")
  .get(tokenIdValidation, getApiTokenDetails)
  .put(tokenIdValidation, updateTokenValidation, updateApiToken)
  .delete(tokenIdValidation, revokeApiToken)

// Token management routes
router.route("/tokens/:tokenId/regenerate").post(tokenIdValidation, regenerateApiToken)

router.route("/tokens/:tokenId/test").post(tokenIdValidation, testApiToken)

export default router
