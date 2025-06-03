import mongoose from "mongoose"
import { logger } from "../utils/logger.js"

export async function connectDatabase() {
  try {
    const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/agriculture-weather"

    await mongoose.connect(mongoUri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    })

    mongoose.connection.on("error", (error) => {
      logger.error("MongoDB connection error:", error)
    })

    mongoose.connection.on("disconnected", () => {
      logger.warn("MongoDB disconnected")
    })

    logger.info("MongoDB connected successfully")
  } catch (error) {
    logger.error("MongoDB connection failed:", error)
    throw error
  }
}
