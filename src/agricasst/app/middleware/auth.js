import jwt from "jsonwebtoken"
import { logger } from "../utils/logger.js"
import { ApiResponse } from "../utils/apiResponse.js"

export const authMiddleware = async (req, res, next) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "")

    if (!token) {
      return res.status(401).json(ApiResponse.error("Access denied. No token provided."))
    }

    // Verify token with your auth server or decode locally
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "your-secret-key")

    // Optional: Validate token with auth server
    if (process.env.AUTH_SERVER_URL) {
      const isValid = await validateTokenWithAuthServer(token)
      if (!isValid) {
        return res.status(401).json(ApiResponse.error("Token validation failed."))
      }
    }

    req.user = decoded
    next()
  } catch (error) {
    logger.error("Auth middleware error:", error)

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json(ApiResponse.error("Invalid token."))
    }

    if (error.name === "TokenExpiredError") {
      return res.status(401).json(ApiResponse.error("Token expired."))
    }

    res.status(500).json(ApiResponse.error("Authentication error."))
  }
}

export const validateTokenWithAuthServer = async (token) => {
  try {
    const response = await fetch(`${process.env.AUTH_SERVER_URL}/validate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    })

    return response.ok
  } catch (error) {
    logger.error("Auth server validation error:", error)
    return false
  }
}

// Optional middleware for role-based access
export const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(403).json(ApiResponse.error("Access denied. No role information."))
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json(ApiResponse.error("Access denied. Insufficient permissions."))
    }

    next()
  }
}
