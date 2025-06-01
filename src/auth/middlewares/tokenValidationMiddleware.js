import { body, query, validationResult } from "express-validator"
import { AppError } from "../utils/appError.js"

// Middleware to check validation results
const validateResults = (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map((error) => ({
      field: error.path,
      message: error.msg,
      value: error.value,
    }))
    return next(new AppError("Validation failed", 400, errorMessages))
  }
  next()
}

// Validation for full token validation endpoint
export const validateTokenValidation = [
  body("token")
    .optional()
    .isString()
    .withMessage("Token must be a string")
    .matches(/^clycites_[0-9a-f]{64}$/)
    .withMessage("Invalid token format"),
  validateResults,
]

// Validation for quick token validation endpoint
export const quickValidateTokenValidation = [
  body("token")
    .optional()
    .isString()
    .withMessage("Token must be a string")
    .matches(/^clycites_[0-9a-f]{64}$/)
    .withMessage("Invalid token format"),
  validateResults,
]

// Validation for token info endpoint
export const tokenInfoValidation = [
  query("tokenId").optional().isMongoId().withMessage("Invalid token ID format"),
  query("token")
    .optional()
    .isString()
    .withMessage("Token must be a string")
    .matches(/^clycites_[0-9a-f]{64}$/)
    .withMessage("Invalid token format"),
  validateResults,
]

// Validation for token scope validation endpoint
export const tokenScopeValidation = [
  body("token")
    .optional()
    .isString()
    .withMessage("Token must be a string")
    .matches(/^clycites_[0-9a-f]{64}$/)
    .withMessage("Invalid token format"),
  body("scopes").isArray({ min: 1 }).withMessage("At least one scope is required"),
  body("scopes.*")
    .isString()
    .withMessage("Each scope must be a string")
    .isIn([
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
      "invite",
      "export",
      "import",
      "manage",
    ])
    .withMessage("Invalid scope provided"),
  validateResults,
]

// Validation for token resource validation endpoint
export const tokenResourceValidation = [
  body("token")
    .optional()
    .isString()
    .withMessage("Token must be a string")
    .matches(/^clycites_[0-9a-f]{64}$/)
    .withMessage("Invalid token format"),
  body("resource").isString().withMessage("Resource must be a string").notEmpty().withMessage("Resource is required"),
  body("actions").isArray({ min: 1 }).withMessage("At least one action is required"),
  body("actions.*")
    .isString()
    .withMessage("Each action must be a string")
    .isIn(["create", "read", "update", "delete", "manage", "invite", "approve", "export", "import"])
    .withMessage("Invalid action provided"),
  validateResults,
]

export default {
  validateTokenValidation,
  quickValidateTokenValidation,
  tokenInfoValidation,
  tokenScopeValidation,
  tokenResourceValidation,
}
