import { logger } from "../utils/logger.js"
import { ApiResponse } from "../utils/apiResponse.js"

export const errorHandler = (err, req, res, next) => {
  logger.error("Error:", {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get("User-Agent"),
    userId: req.user?.id,
  })

  // Mongoose validation error
  if (err.name === "ValidationError") {
    const errors = Object.values(err.errors).map((e) => e.message)
    return res.status(400).json(ApiResponse.error("Validation Error", { errors }))
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0]
    return res.status(400).json(ApiResponse.error(`${field} already exists`))
  }

  // Mongoose cast error
  if (err.name === "CastError") {
    return res.status(400).json(ApiResponse.error("Invalid ID format"))
  }

  // JWT errors
  if (err.name === "JsonWebTokenError") {
    return res.status(401).json(ApiResponse.error("Invalid token"))
  }

  if (err.name === "TokenExpiredError") {
    return res.status(401).json(ApiResponse.error("Token expired"))
  }

  // API rate limit error
  if (err.status === 429) {
    return res.status(429).json(
      ApiResponse.error("Too many requests", {
        retryAfter: err.retryAfter,
      }),
    )
  }

  // Default error
  const statusCode = err.statusCode || 500
  const message = err.message || "Internal Server Error"

  res.status(statusCode).json(
    ApiResponse.error(message, {
      ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
    }),
  )
}

// Async error wrapper
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next)
}
