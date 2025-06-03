import express from "express"
import jwt from "jsonwebtoken"
import { body, validationResult } from "express-validator"
import { User } from "../models/user.model"
import { logger } from "../utils/logger"

const router = express.Router()

// Register
router.post(
  "/register",
  [
    body("email").isEmail().normalizeEmail(),
    body("password").isLength({ min: 6 }),
    body("firstName").trim().isLength({ min: 1 }),
    body("lastName").trim().isLength({ min: 1 }),
    body("phoneNumber").optional().isMobilePhone("any"),
    body("language").optional().isIn(["en", "sw", "rw", "lg"]),
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

      const { email, password, firstName, lastName, phoneNumber, language, timezone } = req.body

      // Check if user already exists
      const existingUser = await User.findOne({ email })
      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: "User already exists with this email",
        })
      }

      // Create new user
      const user = new User({
        email,
        password,
        firstName,
        lastName,
        phoneNumber,
        language: language || "en",
        timezone: timezone || "Africa/Kampala",
      })

      await user.save()

      // Generate JWT token
      const token = jwt.sign({ userId: user._id, email: user.email }, process.env.JWT_SECRET || "your-secret-key", {
        expiresIn: "7d",
      })

      logger.info(`New user registered: ${email}`)

      res.status(201).json({
        success: true,
        message: "User registered successfully",
        data: {
          user: {
            id: user._id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            language: user.language,
            timezone: user.timezone,
            isVerified: user.isVerified,
          },
          token,
        },
      })
    } catch (error) {
      logger.error("Registration error:", error)
      res.status(500).json({
        success: false,
        message: "Internal server error",
      })
    }
  },
)

// Login
router.post("/login", [body("email").isEmail().normalizeEmail(), body("password").exists()], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation errors",
        errors: errors.array(),
      })
    }

    const { email, password } = req.body

    // Find user
    const user = await User.findOne({ email })
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      })
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password)
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      })
    }

    // Generate JWT token
    const token = jwt.sign({ userId: user._id, email: user.email }, process.env.JWT_SECRET || "your-secret-key", {
      expiresIn: "7d",
    })

    logger.info(`User logged in: ${email}`)

    res.json({
      success: true,
      message: "Login successful",
      data: {
        user: {
          id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          language: user.language,
          timezone: user.timezone,
          isVerified: user.isVerified,
        },
        token,
      },
    })
  } catch (error) {
    logger.error("Login error:", error)
    res.status(500).json({
      success: false,
      message: "Internal server error",
    })
  }
})

// Refresh token
router.post("/refresh", async (req, res) => {
  try {
    const { token } = req.body

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Token required",
      })
    }

    // Verify and decode token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "your-secret-key") as any

    // Find user
    const user = await User.findById(decoded.userId)
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid token",
      })
    }

    // Generate new token
    const newToken = jwt.sign({ userId: user._id, email: user.email }, process.env.JWT_SECRET || "your-secret-key", {
      expiresIn: "7d",
    })

    res.json({
      success: true,
      message: "Token refreshed successfully",
      data: { token: newToken },
    })
  } catch (error) {
    logger.error("Token refresh error:", error)
    res.status(401).json({
      success: false,
      message: "Invalid token",
    })
  }
})

export default router
