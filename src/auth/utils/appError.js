class AppError extends Error {
  constructor(message, statusCode, validationErrors = null) {
    super(message)

    this.statusCode = statusCode
    this.status = `${statusCode}`.startsWith("4") ? "fail" : "error"
    this.isOperational = true
    this.validationErrors = validationErrors

    Error.captureStackTrace(this, this.constructor)
  }
}

export { AppError }
