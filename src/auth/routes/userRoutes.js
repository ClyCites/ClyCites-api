import express from "express"
import { body } from "express-validator"
import {
  getAllUsers,
  getOrganizationUsers,
  updateUserGlobalRole,
  deactivateUser,
} from "../controllers/userController.js"
import { protect } from "../middlewares/authMiddleware.js"

const router = express.Router()

// All routes require authentication
router.use(protect)

// User routes
router.route("/").get(getAllUsers)

router.route("/organizations/:orgId/users").get(getOrganizationUsers)

router
  .route("/:userId/global-role")
  .put(
    body("globalRole").isIn(["super_admin", "system_admin", "support", "user"]).withMessage("Invalid global role"),
    updateUserGlobalRole,
  )

router.route("/:userId/deactivate").put(deactivateUser)

export default router
