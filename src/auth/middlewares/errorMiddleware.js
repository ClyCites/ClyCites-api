import { AppError } from "../utils/appError.js"
import logger from "../utils/logger.js"

// Handle CastError (Invalid MongoDB ObjectId)
const handleCastErrorDB = (err) => {
  const message = `Invalid ${err.path}: ${err.value}`
  return new AppError(message, 400)
}

// Handle Duplicate field error
const handleDuplicateFieldsDB = (err) => {
  const field = Object.keys(err.keyValue)[0]
  const value = err.keyValue[field]
  const message = `${field.charAt(0).toUpperCase() + field.slice(1)} '${value}' already exists. Please use another value.`
  return new AppError(message, 400)
}

// Handle Validation Error
const handleValidationErrorDB = (err) => {
  const errors = Object.values(err.errors).map((el) => el.message)
  const message = `Invalid input data. ${errors.join(". ")}`
  return new AppError(message, 400)
}

// Handle JWT Error
const handleJWTError = () => new AppError("Invalid token. Please log in again!", 401)

// Handle JWT Expired Error
const handleJWTExpiredError = () => new AppError("Your token has expired! Please log in again.", 401)

// Send error in development
const sendErrorDev = (err, req, res) => {
  // Log error
  logger.error("Error 💥", {
    error: err,
    request: {
      method: req.method,
      url: req.originalUrl,
      headers: req.headers,
      body: req.body,
      user: req.user?.id,
    },
  })

  // API Error
  if (req.originalUrl.startsWith("/api")) {
    return res.status(err.statusCode).json({
      success: false,
      error: err,
      message: err.message,
      stack: err.stack,
      validationErrors: err.validationErrors,
    })
  }

  // Rendered website error
  res.status(err.statusCode).render("error", {
    title: "Something went wrong!",
    msg: err.message,
  })
}

// Send error in production
const sendErrorProd = (err, req, res) => {
  // Log error
  logger.error("Error 💥", {
    message: err.message,
    statusCode: err.statusCode,
    isOperational: err.isOperational,
    request: {
      method: req.method,
      url: req.originalUrl,
      user: req.user?.id,
    },
  })

  // API Error
  if (req.originalUrl.startsWith("/api")) {
    // Operational, trusted error: send message to client
    if (err.isOperational) {
      return res.status(err.statusCode).json({
        success: false,
        message: err.message,
        validationErrors: err.validationErrors,
      })
    }

    // Programming or other unknown error: don't leak error details
    return res.status(500).json({
      success: false,
      message: "Something went wrong! Please try again later.",
    })
  }

  // Rendered website error
  if (err.isOperational) {
    return res.status(err.statusCode).render("error", {
      title: "Something went wrong!",
      msg: err.message,
    })
  }

  // Programming or other unknown error: don't leak error details
  res.status(err.statusCode).render("error", {
    title: "Something went wrong!",
    msg: "Please try again later.",
  })
}

// Global error handling middleware
export const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500
  err.status = err.status || "error"

  if (process.env.NODE_ENV === "development") {
    sendErrorDev(err, req, res)
  } else {
    let error = { ...err }
    error.message = err.message

    // Handle specific MongoDB errors
    if (error.name === "CastError") error = handleCastErrorDB(error)
    if (error.code === 11000) error = handleDuplicateFieldsDB(error)
    if (error.name === "ValidationError") error = handleValidationErrorDB(error)
    if (error.name === "JsonWebTokenError") error = handleJWTError()
    if (error.name === "TokenExpiredError") error = handleJWTExpiredError()

    sendErrorProd(error, req, res)
  }
}

// Handle 404 errors
export const notFound = (req, res, next) => {
  const message = `Not found - ${req.originalUrl}`
  logger.warn("404 Error", {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get("User-Agent"),
  })

  next(new AppError(message, 404))
}

// Handle async errors in routes
export const catchAsync = (fn) => {
  return (req, res, next) => {
    fn(req, res, next).catch(next)
  }
}
