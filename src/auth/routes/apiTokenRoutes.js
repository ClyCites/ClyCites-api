import express from "express"
import { body } from "express-validator"
import { createApiToken, getUserApiTokens, revokeApiToken } from "../controllers/apiTokenController.js"
import { protect } from "../middlewares/authMiddleware.js"

const router = express.Router()

// Validation rules
const tokenValidation = [
  body("name").trim().isLength({ min: 2, max: 100 }).withMessage("Token name must be between 2 and 100 characters"),
  body("description").optional().isLength({ max: 500 }).withMessage("Description cannot exceed 500 characters"),
  body("scopes").isArray().withMessage("Scopes must be an array"),
  body("permissions").optional().isArray().withMessage("Permissions must be an array"),
  body("applicationId").optional().isMongoId().withMessage("Please provide a valid application ID"),
  body("expiresAt").optional().isISO8601().withMessage("Please provide a valid expiration date"),
]

// All routes require authentication
router.use(protect)

// API Token routes
router.route("/organizations/:orgId/tokens").get(getUserApiTokens).post(tokenValidation, createApiToken)

router.route("/:tokenId").delete(revokeApiToken)

export default router
