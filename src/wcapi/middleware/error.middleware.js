import { logger } from "../utils/logger.js"

export function errorHandler(error, req, res, next) {
  logger.error("Unhandled error:", error)

  // Mongoose validation error
  if (error.name === "ValidationError") {
    const errors = Object.values(error.errors).map((err) => ({
      field: err.path,
      message: err.message,
    }))

    return res.status(400).json({
      success: false,
      message: "Validation error",
      errors,
    })
  }

  // Mongoose duplicate key error
  if (error.code === 11000) {
    const field = Object.keys(error.keyValue)[0]
    return res.status(409).json({
      success: false,
      message: `${field} already exists`,
    })
  }

  // Default error
  res.status(500).json({
    success: false,
    message: "Internal server error",
  })
}
