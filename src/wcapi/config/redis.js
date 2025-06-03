import Redis from "ioredis"
import { logger } from "../utils/logger.js"

let redisClient

export async function connectRedis() {
  try {
    redisClient = new Redis({
      host: process.env.REDIS_HOST || "localhost",
      port: Number.parseInt(process.env.REDIS_PORT || "6379"),
      password: process.env.REDIS_PASSWORD,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
    })

    redisClient.on("error", (error) => {
      logger.error("Redis connection error:", error)
    })

    redisClient.on("connect", () => {
      logger.info("Redis connected successfully")
    })

    return redisClient
  } catch (error) {
    logger.error("Redis connection failed:", error)
    throw error
  }
}

export function getRedisClient() {
  if (!redisClient) {
    throw new Error("Redis client not initialized")
  }
  return redisClient
}
