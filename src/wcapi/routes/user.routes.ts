import express from "express"
import { body, validationResult } from "express-validator"
import { User } from "../models/user.model"
import { authMiddleware } from "../middleware/auth.middleware"
import { logger } from "../utils/logger"

const router = express.Router()

// Apply authentication middleware
router.use(authMiddleware)

// Get user profile
router.get("/profile", async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select("-password")

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      })
    }

    res.json({
      success: true,
      message: "User profile retrieved successfully",
      data: user,
    })
  } catch (error) {
    logger.error("Error fetching user profile:", error)
    res.status(500).json({
      success: false,
      message: "Failed to fetch user profile",
    })
  }
})

// Update user profile
router.put(
  "/profile",
  [
    body("firstName").optional().trim().isLength({ min: 1 }),
    body("lastName").optional().trim().isLength({ min: 1 }),
    body("phoneNumber").optional().isMobilePhone("any"),
    body("language").optional().isIn(["en", "sw", "rw", "lg"]),
    body("timezone").optional().isString(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation errors",
          errors: errors.array(),
        })
      }

      const user = await User.findByIdAndUpdate(req.user.userId, req.body, { new: true, runValidators: true }).select(
        "-password",
      )

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        })
      }

      res.json({
        success: true,
        message: "User profile updated successfully",
        data: user,
      })
    } catch (error) {
      logger.error("Error updating user profile:", error)
      res.status(500).json({
        success: false,
        message: "Failed to update user profile",
      })
    }
  },
)

export default router
