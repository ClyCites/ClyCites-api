import mongoose from "mongoose"
import { logger } from "../app/utils/logger.js"

export const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/agric-assistant", {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    })

    logger.info(`MongoDB Connected: ${conn.connection.host}`)

    // Handle connection events
    mongoose.connection.on("error", (err) => {
      logger.error("MongoDB connection error:", err)
    })

    mongoose.connection.on("disconnected", () => {
      logger.warn("MongoDB disconnected")
    })

    mongoose.connection.on("reconnected", () => {
      logger.info("MongoDB reconnected")
    })
  } catch (error) {
    logger.error("MongoDB connection failed:", error)
    process.exit(1)
  }
}

export const disconnectDB = async () => {
  try {
    await mongoose.connection.close()
    logger.info("MongoDB connection closed")
  } catch (error) {
    logger.error("Error closing MongoDB connection:", error)
  }
}
