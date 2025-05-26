import winston from "winston"
import path from "path"
import fs from "fs"

// Ensure logs directory exists
const logsDir = "logs"
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir)
}

// Custom format for logs
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: "YYYY-MM-DD HH:mm:ss",
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.prettyPrint(),
)

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: "HH:mm:ss",
  }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`
    if (Object.keys(meta).length > 0) {
      msg += `\n${JSON.stringify(meta, null, 2)}`
    }
    return msg
  }),
)

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: logFormat,
  defaultMeta: { service: "clycites-auth" },
  transports: [
    // Error log file
    new winston.transports.File({
      filename: path.join(logsDir, "error.log"),
      level: "error",
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // Combined log file
    new winston.transports.File({
      filename: path.join(logsDir, "combined.log"),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
  // Handle exceptions and rejections
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, "exceptions.log"),
    }),
  ],
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, "rejections.log"),
    }),
  ],
})

// Add console transport for development
if (process.env.NODE_ENV !== "production") {
  logger.add(
    new winston.transports.Console({
      format: consoleFormat,
    }),
  )
}

// Create a stream object for Morgan HTTP logging
logger.stream = {
  write: (message) => {
    logger.info(message.trim())
  },
}

// Helper methods for structured logging
logger.logRequest = (req, res, responseTime) => {
  logger.info("HTTP Request", {
    method: req.method,
    url: req.originalUrl,
    statusCode: res.statusCode,
    responseTime: `${responseTime}ms`,
    userAgent: req.get("User-Agent"),
    ip: req.ip,
    userId: req.user?.id,
  })
}

logger.logError = (error, req = null) => {
  const errorLog = {
    message: error.message,
    stack: error.stack,
    statusCode: error.statusCode,
    isOperational: error.isOperational,
  }

  if (req) {
    errorLog.request = {
      method: req.method,
      url: req.originalUrl,
      headers: req.headers,
      body: req.body,
      userId: req.user?.id,
    }
  }

  logger.error("Application Error", errorLog)
}

logger.logAuth = (action, userId, details = {}) => {
  logger.info("Authentication Event", {
    action,
    userId,
    timestamp: new Date().toISOString(),
    ...details,
  })
}

logger.logSecurity = (event, details = {}) => {
  logger.warn("Security Event", {
    event,
    timestamp: new Date().toISOString(),
    ...details,
  })
}

export default logger
