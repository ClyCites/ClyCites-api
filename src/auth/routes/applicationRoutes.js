import express from "express"
import { body } from "express-validator"
import {
  createApplication,
  getOrganizationApplications,
  getApplication,
  regenerateClientSecret,
} from "../controllers/applicationController.js"
import { protect } from "../middlewares/authMiddleware.js"

const router = express.Router()

// Validation rules
const applicationValidation = [
  body("name")
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Application name must be between 2 and 100 characters"),
  body("description").optional().isLength({ max: 500 }).withMessage("Description cannot exceed 500 characters"),
  body("type")
    .isIn(["web", "mobile", "desktop", "api", "service", "integration"])
    .withMessage("Invalid application type"),
  body("platform").optional().isIn(["web", "ios", "android", "windows", "macos", "linux", "cross-platform"]),
  body("redirectUris").optional().isArray().withMessage("Redirect URIs must be an array"),
  body("scopes").isArray().withMessage("Scopes must be an array"),
  body("grantTypes").optional().isArray().withMessage("Grant types must be an array"),
]

// All routes require authentication
router.use(protect)

// Application routes
router
  .route("/organizations/:orgId/applications")
  .get(getOrganizationApplications)
  .post(applicationValidation, createApplication)

router.route("/:appId").get(getApplication)

router.route("/:appId/regenerate-secret").post(regenerateClientSecret)

export default router
