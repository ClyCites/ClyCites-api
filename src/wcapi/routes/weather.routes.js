import express from "express"
import { query, validationResult } from "express-validator"
import { weatherService } from "../services/weather.service.js"
import { logger } from "../utils/logger.js"

const router = express.Router()

// Get current weather
router.get(
  "/current",
  [query("latitude").isFloat({ min: -90, max: 90 }), query("longitude").isFloat({ min: -180, max: 180 })],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation errors",
          errors: errors.array(),
        })
      }

      const { latitude, longitude } = req.query
      const weatherData = await weatherService.getCurrentWeather(
        Number.parseFloat(latitude),
        Number.parseFloat(longitude),
      )

      res.json({
        success: true,
        message: "Current weather data retrieved successfully",
        data: weatherData,
      })
    } catch (error) {
      logger.error("Error fetching current weather:", error)
      res.status(500).json({
        success: false,
        message: "Failed to fetch current weather data",
      })
    }
  },
)

// Get weather forecast
router.get(
  "/forecast",
  [
    query("latitude").isFloat({ min: -90, max: 90 }),
    query("longitude").isFloat({ min: -180, max: 180 }),
    query("days").optional().isInt({ min: 1, max: 14 }),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation errors",
          errors: errors.array(),
        })
      }

      const { latitude, longitude, days } = req.query
      const forecastData = await weatherService.getForecast(
        Number.parseFloat(latitude),
        Number.parseFloat(longitude),
        Number.parseInt(days) || 7,
      )

      res.json({
        success: true,
        message: "Weather forecast data retrieved successfully",
        data: forecastData,
      })
    } catch (error) {
      logger.error("Error fetching weather forecast:", error)
      res.status(500).json({
        success: false,
        message: "Failed to fetch weather forecast data",
      })
    }
  },
)

// Get historical weather
router.get(
  "/historical",
  [
    query("latitude").isFloat({ min: -90, max: 90 }),
    query("longitude").isFloat({ min: -180, max: 180 }),
    query("startDate").isISO8601(),
    query("endDate").isISO8601(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation errors",
          errors: errors.array(),
        })
      }

      const { latitude, longitude, startDate, endDate } = req.query
      const historicalData = await weatherService.getHistoricalWeather(
        Number.parseFloat(latitude),
        Number.parseFloat(longitude),
        startDate,
        endDate,
      )

      res.json({
        success: true,
        message: "Historical weather data retrieved successfully",
        data: historicalData,
      })
    } catch (error) {
      logger.error("Error fetching historical weather:", error)
      res.status(500).json({
        success: false,
        message: "Failed to fetch historical weather data",
      })
    }
  },
)

export default router
