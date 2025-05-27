import express from "express"
import { body } from "express-validator"
import passport from "passport"
import jwt from "jsonwebtoken"
import crypto from "crypto"
import {
  registerUser,
  loginUser,
  logoutUser,
  getMe,
  updateProfile,
  refreshToken,
  verifyEmail,
  forgotPassword,
  resetPassword,
  changePassword,
} from "../controllers/authController.js"
import { protect, authorize } from "../middlewares/authMiddleware.js"
import { uploadProfilePicture } from "../middlewares/uploadMiddleware.js"
import User from "../models/userModel.js"
import { asyncHandler } from "../utils/asyncHandler.js"
import { AppError } from "../utils/appError.js"

const router = express.Router()

// Validation rules
const registerValidation = [
  body("username")
    .isLength({ min: 3, max: 30 })
    .withMessage("Username must be between 3 and 30 characters")
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage("Username can only contain letters, numbers, and underscores"),
  body("email").isEmail().normalizeEmail().withMessage("Please provide a valid email"),
  body("password")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters long")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage(
      "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character",
    ),
  body("firstName")
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage("First name is required and must not exceed 50 characters"),
  body("lastName")
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage("Last name is required and must not exceed 50 characters"),
]

const loginValidation = [
  body("identifier").notEmpty().withMessage("Email or username is required"),
  body("password").notEmpty().withMessage("Password is required"),
]

const updateProfileValidation = [
  body("firstName")
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage("First name must not exceed 50 characters"),
  body("lastName")
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage("Last name must not exceed 50 characters"),
  body("username")
    .optional()
    .isLength({ min: 3, max: 30 })
    .withMessage("Username must be between 3 and 30 characters")
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage("Username can only contain letters, numbers, and underscores"),
]

const forgotPasswordValidation = [body("email").isEmail().normalizeEmail().withMessage("Please provide a valid email")]

const resetPasswordValidation = [
  body("password")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters long")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage(
      "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character",
    ),
]

const changePasswordValidation = [
  body("currentPassword").notEmpty().withMessage("Current password is required"),
  body("newPassword")
    .isLength({ min: 8 })
    .withMessage("New password must be at least 8 characters long")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage(
      "New password must contain at least one uppercase letter, one lowercase letter, one number, and one special character",
    ),
]

// Public routes (no authentication required)
router.post("/register", registerValidation, registerUser)
router.post("/login", loginValidation, loginUser)
router.post("/refresh-token", refreshToken)
router.get("/verify-email/:token", verifyEmail)
router.post("/forgot-password", forgotPasswordValidation, forgotPassword)
router.put("/reset-password/:token", resetPasswordValidation, resetPassword)

// Google OAuth routes
router.get("/google", passport.authenticate("google", { scope: ["profile", "email"] }))
router.get(
  "/google/callback",
  passport.authenticate("google", { failureRedirect: `${process.env.CLIENT_URL}/login?error=oauth_failed` }),
  asyncHandler(async (req, res) => {
    // Generate tokens for OAuth user
    const token = jwt.sign({ id: req.user._id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRE || "15m",
    })

    const refreshToken = jwt.sign({ id: req.user._id }, process.env.JWT_REFRESH_SECRET, {
      expiresIn: process.env.JWT_REFRESH_EXPIRE || "7d",
    })

    // Save refresh token
    req.user.refreshTokens.push({
      token: crypto.createHash("sha256").update(refreshToken).digest("hex"),
    })
    await req.user.save()

    // Set cookies and redirect
    const cookieOptions = {
      expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    }

    res
      .cookie("token", token, cookieOptions)
      .cookie("refreshToken", refreshToken, cookieOptions)
      .redirect(`${process.env.CLIENT_URL}/dashboard?login=success`)
  }),
)

// Protected routes (authentication required)
router.use(protect) // All routes below this middleware are protected

router.post("/logout", logoutUser)
router.get("/me", getMe)
router.put("/profile", uploadProfilePicture, updateProfileValidation, updateProfile)
router.put("/change-password", changePasswordValidation, changePassword)

// Admin routes
router.get(
  "/users",
  authorize("admin"),
  asyncHandler(async (req, res) => {
    const page = Number.parseInt(req.query.page) || 1
    const limit = Number.parseInt(req.query.limit) || 10
    const skip = (page - 1) * limit

    const users = await User.find({ isActive: true })
      .select("-refreshTokens -emailVerificationToken -passwordResetToken")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)

    const total = await User.countDocuments({ isActive: true })

    res.status(200).json({
      success: true,
      data: {
        users,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    })
  }),
)

// Test email configuration (Admin only)
router.post(
  "/test-email",
  authorize("admin"),
  asyncHandler(async (req, res, next) => {
    const { sendTestEmail } = await import("../utils/emailService.js")
    const { email } = req.body

    if (!email) {
      return next(new AppError("Email address is required", 400))
    }

    try {
      const result = await sendTestEmail(email)
      res.status(200).json({
        success: true,
        message: "Test email sent successfully",
        data: {
          messageId: result.messageId,
          response: result.response,
        },
      })
    } catch (error) {
      return next(new AppError(`Failed to send test email: ${error.message}`, 500))
    }
  }),
)

router.put(
  "/users/:userId/role",
  authorize("admin"),
  asyncHandler(async (req, res, next) => {
    const { role } = req.body

    if (!["viewer", "editor", "admin"].includes(role)) {
      return next(new AppError("Invalid role specified", 400))
    }

    const user = await User.findByIdAndUpdate(req.params.userId, { role }, { new: true, runValidators: true }).select(
      "-refreshTokens -emailVerificationToken -passwordResetToken",
    )

    if (!user) {
      return next(new AppError("User not found", 404))
    }

    res.status(200).json({
      success: true,
      message: "User role updated successfully",
      data: { user },
    })
  }),
)

router.put(
  "/users/:userId/status",
  authorize("admin"),
  asyncHandler(async (req, res, next) => {
    const { isActive } = req.body

    const user = await User.findByIdAndUpdate(
      req.params.userId,
      { isActive },
      { new: true, runValidators: true },
    ).select("-refreshTokens -emailVerificationToken -passwordResetToken")

    if (!user) {
      return next(new AppError("User not found", 404))
    }

    res.status(200).json({
      success: true,
      message: `User ${isActive ? "activated" : "deactivated"} successfully`,
      data: { user },
    })
  }),
)

export default router
