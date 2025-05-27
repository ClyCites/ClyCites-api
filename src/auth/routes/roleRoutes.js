import express from "express"
import { body } from "express-validator"
import { createRole, getOrganizationRoles, updateRole } from "../controllers/roleController.js"
import { protect } from "../middlewares/authMiddleware.js"

const router = express.Router()

// Validation rules
const roleValidation = [
  body("name").trim().isLength({ min: 2, max: 50 }).withMessage("Role name must be between 2 and 50 characters"),
  body("description").optional().isLength({ max: 200 }).withMessage("Description cannot exceed 200 characters"),
  body("level").isInt({ min: 0, max: 100 }).withMessage("Level must be between 0 and 100"),
  body("permissions").isArray().withMessage("Permissions must be an array"),
  body("inheritsFrom").optional().isArray().withMessage("InheritsFrom must be an array"),
]

// All routes require authentication
router.use(protect)

// Role routes
router.route("/organizations/:orgId/roles").get(getOrganizationRoles).post(roleValidation, createRole)

router.route("/:roleId").put(roleValidation, updateRole)

export default router
