import express from "express"
import { body } from "express-validator"
import { createTeam, getOrganizationTeams, inviteUserToTeam } from "../controllers/teamController.js"
import { protect } from "../middlewares/authMiddleware.js"

const router = express.Router()

// Validation rules
const createTeamValidation = [
  body("name").trim().isLength({ min: 2, max: 100 }).withMessage("Team name must be between 2 and 100 characters"),
  body("description").optional().isLength({ max: 500 }).withMessage("Description cannot exceed 500 characters"),
  body("type").optional().isIn(["department", "project", "functional", "cross-functional"]),
  body("visibility").optional().isIn(["public", "private", "secret"]),
  body("parentId").optional().isMongoId().withMessage("Please provide a valid parent team ID"),
]

const inviteToTeamValidation = [
  body("userId").isMongoId().withMessage("Please provide a valid user ID"),
  body("roleId").isMongoId().withMessage("Please provide a valid role ID"),
]

// All routes require authentication
router.use(protect)

// Team routes
router.route("/organizations/:orgId/teams").get(getOrganizationTeams).post(createTeamValidation, createTeam)

router.route("/:teamId/invite").post(inviteToTeamValidation, inviteUserToTeam)

export default router
