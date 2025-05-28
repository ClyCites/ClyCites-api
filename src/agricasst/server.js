import express from "express"
import mongoose from "mongoose"
import cors from "cors"
import dotenv from "dotenv"
import rateLimit from "express-rate-limit"
import helmet from "helmet"
import compression from "compression"

// Import configurations
import { connectDB } from "./config/database.js"
import { corsConfig } from "./config/cors.js"
import { rateLimitConfig } from "./config/rateLimit.js"

// Import routes
import weatherRoutes from "./app/routes/weather.js"
import cropRoutes from "./app/routes/crops.js"
import recommendationRoutes from "./app/routes/recommendations.js"
import alertRoutes from "./app/routes/alerts.js"

// Import middleware
import { authMiddleware } from "./app/middleware/auth.js"
import { errorHandler } from "./app/middleware/errorHandler.js"
import { requestLogger } from "./app/middleware/requestLogger.js"
import { logger } from "./app/utils/logger.js"

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

// Security middleware
app.use(helmet())
app.use(compression())

// Rate limiting
app.use("/api/", rateLimit(rateLimitConfig))

// CORS configuration
app.use(cors(corsConfig))

// Request logging
app.use(requestLogger)

// Body parsing middleware
app.use(express.json({ limit: "10mb" }))
app.use(express.urlencoded({ extended: true }))

// Connect to MongoDB
connectDB()

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    timestamp: new Date().toISOString(),
    service: "ClyCites Agric-Assistant",
    version: "1.0.0",
    environment: process.env.NODE_ENV || "development",
  })
})

// API Documentation endpoint
app.get("/api", (req, res) => {
  res.json({
    service: "ClyCites Agric-Assistant API",
    version: "1.0.0",
    endpoints: {
      weather: "/api/weather",
      crops: "/api/crops",
      recommendations: "/api/recommendations",
      alerts: "/api/alerts",
    },
    documentation: "https://docs.clycites.com/agric-assistant",
  })
})

// API routes
app.use("/api/weather", authMiddleware, weatherRoutes)
app.use("/api/crops", authMiddleware, cropRoutes)
app.use("/api/recommendations", authMiddleware, recommendationRoutes)
app.use("/api/alerts", authMiddleware, alertRoutes)

// Error handling middleware
app.use(errorHandler)

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
    availableEndpoints: ["/health", "/api", "/api/weather", "/api/crops", "/api/recommendations", "/api/alerts"],
  })
})

// Graceful shutdown
const gracefulShutdown = () => {
  logger.info("Received shutdown signal, shutting down gracefully")

  mongoose.connection.close(() => {
    logger.info("MongoDB connection closed")
    process.exit(0)
  })
}

process.on("SIGTERM", gracefulShutdown)
process.on("SIGINT", gracefulShutdown)

app.listen(PORT, () => {
  logger.info(`AgricAssistant server running on port ${PORT}`)
  logger.info(`Environment: ${process.env.NODE_ENV || "development"}`)
})

export default app
