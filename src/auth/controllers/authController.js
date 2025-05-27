import jwt from "jsonwebtoken"
import crypto from "crypto"
import { validationResult } from "express-validator"
import User from "../models/userModel.js"
import { sendEmail } from "../utils/emailService.js"
import { asyncHandler } from "../utils/asyncHandler.js"
import { AppError } from "../utils/appError.js"

// Generate JWT token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || "15m",
  })
}

// Generate refresh token
const generateRefreshToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRE || "7d",
  })
}

const sendTokenResponse = async (user, statusCode, res, message = "Success") => {
  const token = generateToken(user._id)
  const refreshToken = generateRefreshToken(user._id)

  user.refreshTokens.push({
    token: crypto.createHash("sha256").update(refreshToken).digest("hex"),
  })
  await user.save()

  const options = {
    expires: new Date(Date.now() + (process.env.JWT_COOKIE_EXPIRE || 7) * 24 * 60 * 60 * 1000),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  }

  res
    .status(statusCode)
    .cookie("refreshToken", refreshToken, options)
    .json({
      success: true,
      message,
      data: {
        token,
        refreshToken,
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          fullName: user.fullName,
          role: user.role,
          profilePicture: user.profilePicture,
          isEmailVerified: user.isEmailVerified,
          lastLogin: user.lastLogin,
        },
      },
    })
}

export const registerUser = asyncHandler(async (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return next(new AppError("Validation failed", 400, errors.array()))
  }

  const { username, email, password, firstName, lastName } = req.body

  const existingUser = await User.findOne({
    $or: [{ email: email.toLowerCase() }, { username }],
  })

  if (existingUser) {
    return next(new AppError("User already exists with this email or username", 400))
  }

  const user = await User.create({
    username,
    email: email.toLowerCase(),
    password,
    firstName,
    lastName,
  })

  const verificationToken = user.generateEmailVerificationToken()
  await user.save({ validateBeforeSave: false })

  try {
    const verificationUrl = `${process.env.CLIENT_URL}/verify-email/${verificationToken}`

    await sendEmail({
      email: user.email,
      subject: "ClyCites - Verify Your Email Address",
      template: "emailVerification",
      data: {
        name: user.firstName,
        verificationUrl,
      },
    })

    res.status(201).json({
      success: true,
      message: "User registered successfully. Please check your email to verify your account.",
      data: {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
        },
      },
    })
  } catch (error) {
    user.emailVerificationToken = undefined
    user.emailVerificationExpires = undefined
    await user.save({ validateBeforeSave: false })

    return next(new AppError("Email could not be sent. Please try again later.", 500))
  }
})

export const loginUser = asyncHandler(async (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return next(new AppError("Validation failed", 400, errors.array()))
  }

  const { identifier, password } = req.body

  try {
    const user = await User.findByCredentials(identifier, password)

    if (!user.isEmailVerified) {
      return next(new AppError("Please verify your email address before logging in", 401))
    }

    sendTokenResponse(user, 200, res, "Login successful")
  } catch (error) {
    return next(new AppError(error.message, 401))
  }
})

export const logoutUser = asyncHandler(async (req, res, next) => {
  const refreshToken = req.cookies.refreshToken || req.body.refreshToken

  if (refreshToken) {
    const hashedToken = crypto.createHash("sha256").update(refreshToken).digest("hex")

    await User.updateOne({ _id: req.user.id }, { $pull: { refreshTokens: { token: hashedToken } } })
  }

  res
    .status(200)
    .cookie("refreshToken", "", {
      expires: new Date(0),
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    })
    .json({
      success: true,
      message: "Logout successful",
    })
})

export const getMe = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id)

  res.status(200).json({
    success: true,
    data: {
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: user.fullName,
        role: user.role,
        profilePicture: user.profilePicture,
        isEmailVerified: user.isEmailVerified,
        lastLogin: user.lastLogin,
        createdAt: user.createdAt,
      },
    },
  })
})

export const updateProfile = asyncHandler(async (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return next(new AppError("Validation failed", 400, errors.array()))
  }

  const { firstName, lastName, username } = req.body
  const user = await User.findById(req.user.id)

  if (username && username !== user.username) {
    const existingUser = await User.findOne({ username, _id: { $ne: user._id } })
    if (existingUser) {
      return next(new AppError("Username is already taken", 400))
    }
  }

  // Update fields
  if (firstName) user.firstName = firstName
  if (lastName) user.lastName = lastName
  if (username) user.username = username

  // Handle profile picture upload
  if (req.file) {
    user.profilePicture = `/uploads/profiles/${req.file.filename}`
  }

  await user.save()

  res.status(200).json({
    success: true,
    message: "Profile updated successfully",
    data: {
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: user.fullName,
        role: user.role,
        profilePicture: user.profilePicture,
        isEmailVerified: user.isEmailVerified,
      },
    },
  })
})

// @desc    Refresh access token
// @route   POST /api/auth/refresh-token
// @access  Public
export const refreshToken = asyncHandler(async (req, res, next) => {
  const refreshToken = req.cookies.refreshToken || req.body.refreshToken

  // Check if refresh token is provided
  if (!refreshToken) {
    return next(
      new AppError("Refresh token not provided. Please provide refreshToken in request body or cookies.", 401),
    )
  }

  try {
    // Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET)
    const hashedToken = crypto.createHash("sha256").update(refreshToken).digest("hex")

    // Find user with this refresh token
    const user = await User.findOne({
      _id: decoded.id,
      "refreshTokens.token": hashedToken,
    })

    if (!user) {
      return next(new AppError("Invalid refresh token. Please login again.", 401))
    }

    // Check if user is active
    if (!user.isActive) {
      return next(new AppError("Your account has been deactivated. Please contact support.", 401))
    }

    // Check if account is locked
    if (user.isLocked) {
      return next(new AppError("Account temporarily locked due to too many failed login attempts", 401))
    }

    // Generate new access token
    const newAccessToken = generateToken(user._id)

    res.status(200).json({
      success: true,
      message: "Token refreshed successfully",
      data: {
        token: newAccessToken,
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          fullName: user.fullName,
          role: user.role,
          profilePicture: user.profilePicture,
          isEmailVerified: user.isEmailVerified,
        },
      },
    })
  } catch (error) {
    if (error.name === "JsonWebTokenError") {
      return next(new AppError("Invalid refresh token. Please login again.", 401))
    } else if (error.name === "TokenExpiredError") {
      return next(new AppError("Refresh token expired. Please login again.", 401))
    } else {
      return next(new AppError("Token verification failed. Please login again.", 401))
    }
  }
})

// @desc    Verify email
// @route   GET /api/auth/verify-email/:token
// @access  Public
export const verifyEmail = asyncHandler(async (req, res, next) => {
  // Get hashed token
  const hashedToken = crypto.createHash("sha256").update(req.params.token).digest("hex")

  const user = await User.findOne({
    emailVerificationToken: hashedToken,
    emailVerificationExpires: { $gt: Date.now() },
  })

  if (!user) {
    return next(new AppError("Invalid or expired verification token", 400))
  }

  // Update user
  user.isEmailVerified = true
  user.emailVerificationToken = undefined
  user.emailVerificationExpires = undefined
  await user.save()

  res.status(200).json({
    success: true,
    message: "Email verified successfully",
  })
})

// @desc    Forgot password
// @route   POST /api/auth/forgot-password
// @access  Public
export const forgotPassword = asyncHandler(async (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return next(new AppError("Validation failed", 400, errors.array()))
  }

  const user = await User.findOne({ email: req.body.email.toLowerCase() })

  if (!user) {
    return next(new AppError("No user found with that email address", 404))
  }

  // Generate reset token
  const resetToken = user.generatePasswordResetToken()
  await user.save({ validateBeforeSave: false })

  try {
    const resetUrl = `${process.env.CLIENT_URL}/reset-password/${resetToken}`

    await sendEmail({
      email: user.email,
      subject: "ClyCites - Password Reset Request",
      template: "passwordReset",
      data: {
        name: user.firstName,
        resetUrl,
      },
    })

    res.status(200).json({
      success: true,
      message: "Password reset email sent",
    })
  } catch (error) {
    user.passwordResetToken = undefined
    user.passwordResetExpires = undefined
    await user.save({ validateBeforeSave: false })

    return next(new AppError("Email could not be sent. Please try again later.", 500))
  }
})

// @desc    Reset password
// @route   PUT /api/auth/reset-password/:token
// @access  Public
export const resetPassword = asyncHandler(async (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return next(new AppError("Validation failed", 400, errors.array()))
  }

  // Get hashed token
  const hashedToken = crypto.createHash("sha256").update(req.params.token).digest("hex")

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  })

  if (!user) {
    return next(new AppError("Invalid or expired reset token", 400))
  }

  // Set new password
  user.password = req.body.password
  user.passwordResetToken = undefined
  user.passwordResetExpires = undefined
  user.refreshTokens = [] // Invalidate all refresh tokens
  await user.save()

  sendTokenResponse(user, 200, res, "Password reset successful")
})

// @desc    Change password
// @route   PUT /api/auth/change-password
// @access  Private
export const changePassword = asyncHandler(async (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return next(new AppError("Validation failed", 400, errors.array()))
  }

  const user = await User.findById(req.user.id).select("+password")

  // Check current password
  if (!(await user.matchPassword(req.body.currentPassword))) {
    return next(new AppError("Current password is incorrect", 400))
  }

  user.password = req.body.newPassword
  user.refreshTokens = [] // Invalidate all refresh tokens
  await user.save()

  sendTokenResponse(user, 200, res, "Password changed successfully")
})
