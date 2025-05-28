import { logger } from "../utils/logger.js"

export const requestLogger = (req, res, next) => {
  const start = Date.now()

  // Log request
  logger.info("Request started", {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get("User-Agent"),
    userId: req.user?.id,
  })

  // Override res.end to log response
  const originalEnd = res.end
  res.end = function (chunk, encoding) {
    const duration = Date.now() - start

    logger.info("Request completed", {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userId: req.user?.id,
    })

    originalEnd.call(this, chunk, encoding)
  }

  next()
}
