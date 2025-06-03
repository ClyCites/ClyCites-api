import express from "express"
import cors from "cors"
import helmet from "helmet"
import rateLimit from "express-rate-limit"
import compression from "compression"
import dotenv from "dotenv"
import { connectDatabase } from "./config/database.js"
import { connectRedis } from "./config/redis.js"
import { initializeQueues } from "./services/queue.service.js"
import { errorHandler } from "./middleware/error.middleware.js"
import { logger } from "./utils/logger.js"

// Route imports
import farmRoutes from "./routes/farm.routes.js"
import weatherRoutes from "./routes/weather.routes.js"
import alertRoutes from "./routes/alert.routes.js"
import recommendationRoutes from "./routes/recommendation.routes.js"

// Load environment variables
dotenv.config()

const app = express()
const PORT = process.env.PORT || 3000

// Security middleware
app.use(helmet())
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(",") || ["http://localhost:3000"],
    credentials: true,
  }),
)

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
})
app.use("/api/", limiter)

// Body parsing middleware
app.use(express.json({ limit: "10mb" }))
app.use(express.urlencoded({ extended: true }))
app.use(compression())

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  })
})

// API routes
app.use("/api/farms", farmRoutes)
app.use("/api/weather", weatherRoutes)
app.use("/api/alerts", alertRoutes)
app.use("/api/recommendations", recommendationRoutes)

// Error handling middleware
app.use(errorHandler)

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  })
})

async function startServer() {
  try {
    // Connect to database
    await connectDatabase()
    logger.info("Database connected successfully")

    // Connect to Redis
    await connectRedis()
    logger.info("Redis connected successfully")

    // Initialize background job queues
    await initializeQueues()
    logger.info("Job queues initialized")

    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`)
      logger.info(`Environment: ${process.env.NODE_ENV || "development"}`)
    })
  } catch (error) {
    logger.error("Failed to start server:", error)
    process.exit(1)
  }
}

// Graceful shutdown
process.on("SIGTERM", () => {
  logger.info("SIGTERM received, shutting down gracefully")
  process.exit(0)
})

process.on("SIGINT", () => {
  logger.info("SIGINT received, shutting down gracefully")
  process.exit(0)
})

startServer()

export default app
