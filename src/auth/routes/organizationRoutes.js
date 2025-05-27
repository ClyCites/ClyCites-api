import express from "express"
import { body } from "express-validator"
import {
  createOrganization,
  getUserOrganizations,
  getOrganization,
  updateOrganization,
  inviteUserToOrganization,
  getOrganizationMembers,
} from "../controllers/organizationController.js"
import { protect } from "../middlewares/authMiddleware.js"

const router = express.Router()

// Validation rules
const createOrgValidation = [
  body("name")
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Organization name must be between 2 and 100 characters"),
  body("description").optional().isLength({ max: 500 }).withMessage("Description cannot exceed 500 characters"),
  body("website").optional().isURL().withMessage("Please provide a valid website URL"),
  body("industry")
    .optional()
    .isIn([
      "technology",
      "healthcare",
      "finance",
      "education",
      "retail",
      "manufacturing",
      "consulting",
      "media",
      "nonprofit",
      "government",
      "other",
    ]),
  body("size").optional().isIn(["startup", "small", "medium", "large", "enterprise"]),
]

const inviteValidation = [
  body("email").isEmail().normalizeEmail().withMessage("Please provide a valid email"),
  body("roleId").isMongoId().withMessage("Please provide a valid role ID"),
  body("message").optional().isLength({ max: 500 }).withMessage("Message cannot exceed 500 characters"),
]

// All routes require authentication
router.use(protect)

// Organization routes
router.route("/").get(getUserOrganizations).post(createOrgValidation, createOrganization)

router.route("/:id").get(getOrganization).put(createOrgValidation, updateOrganization)

router.route("/:id/invite").post(inviteValidation, inviteUserToOrganization)

router.route("/:id/members").get(getOrganizationMembers)

export default router
