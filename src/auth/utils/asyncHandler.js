// Wrapper function to handle async errors in Express routes
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next)
}

// Alternative implementation with try-catch
export const asyncHandlerTryCatch = (fn) => {
  return async (req, res, next) => {
    try {
      await fn(req, res, next)
    } catch (error) {
      next(error)
    }
  }
}

// Wrapper for database operations
export const dbHandler = (fn) => {
  return async (...args) => {
    try {
      return await fn(...args)
    } catch (error) {
      console.error("Database operation failed:", error)
      throw error
    }
  }
}
