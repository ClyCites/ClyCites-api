import rateLimit from "express-rate-limit"
import { AppError } from "../utils/appError.js"

// General API rate limiting
export const apiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  message: {
    error: "Too many API requests from this IP, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
})

// Authentication rate limiting
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 10 auth requests per windowMs
  message: {
    error: "Too many authentication attempts, please try again later.",
  },
  skipSuccessfulRequests: true,
})

// Token creation rate limiting
export const tokenRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 1000, // limit each IP to 50 token requests per hour
  message: {
    error: "Too many token creation requests, please try again later.",
  },
})

// Organization creation rate limiting
export const orgCreationRateLimit = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 1000, // limit each IP to 5 org creation requests per day
  message: {
    error: "Too many organization creation requests, please try again tomorrow.",
  },
})

// Dynamic rate limiting based on API token
export const dynamicApiRateLimit = (req, res, next) => {
  if (req.apiToken) {
    const limits = req.apiToken.rateLimits
    const now = new Date()
    const minute = now.getMinutes()
    const hour = now.getHours()

    // Simple in-memory rate limiting (in production, use Redis)
    if (!req.apiToken.usage.rateLimitCounters) {
      req.apiToken.usage.rateLimitCounters = {
        minute: { count: 0, resetTime: now.getTime() + 60000 },
        hour: { count: 0, resetTime: now.getTime() + 3600000 },
      }
    }

    const counters = req.apiToken.usage.rateLimitCounters

    // Reset counters if time window has passed
    if (now.getTime() > counters.minute.resetTime) {
      counters.minute = { count: 0, resetTime: now.getTime() + 60000 }
    }
    if (now.getTime() > counters.hour.resetTime) {
      counters.hour = { count: 0, resetTime: now.getTime() + 3600000 }
    }

    // Check limits
    if (counters.minute.count >= limits.requestsPerMinute) {
      return next(new AppError("Rate limit exceeded: too many requests per minute", 429))
    }
    if (counters.hour.count >= limits.requestsPerHour) {
      return next(new AppError("Rate limit exceeded: too many requests per hour", 429))
    }

    // Increment counters
    counters.minute.count++
    counters.hour.count++
  }

  next()
}

// Generic rate limiter factory function
export const rateLimiter = (options = {}) => {
  const defaultOptions = {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // limit each IP to 100 requests per windowMs
    message: {
      error: "Too many requests from this IP, please try again later.",
    },
    standardHeaders: true,
    legacyHeaders: false,
  }

  return rateLimit({
    ...defaultOptions,
    ...options,
  })
}

// Token validation specific rate limiting
export const tokenValidationRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 1000, // limit each IP to 100 token validation requests per 5 minutes
  message: {
    error: "Too many token validation requests, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
})

// Quick validation rate limiting (more permissive)
export const quickValidationRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 1000, // limit each IP to 200 quick validation requests per minute
  message: {
    error: "Too many quick validation requests, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
})
