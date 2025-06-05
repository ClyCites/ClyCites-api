import express from "express"
import { query, validationResult } from "express-validator"
import { weatherService } from "../services/weather.service.js"
import { logger } from "../utils/logger.js"

const router = express.Router()

// Get available weather variables
router.get("/variables", async (req, res) => {
  try {
    const variables = weatherService.getAvailableVariables()

    res.json({
      success: true,
      message: "Available weather variables retrieved successfully",
      data: variables,
    })
  } catch (error) {
    logger.error("Error fetching weather variables:", error)
    res.status(500).json({
      success: false,
      message: "Failed to fetch weather variables",
    })
  }
})

// Get current weather with customizable variables
router.get(
  "/current",
  [
    query("latitude").isFloat({ min: -90, max: 90 }),
    query("longitude").isFloat({ min: -180, max: 180 }),
    query("variables").optional().isString(),
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

      const { latitude, longitude, variables, timezone, temperatureUnit, windSpeedUnit, precipitationUnit } = req.query

      // Parse variables if provided
      const parsedVariables = variables ? variables.split(",") : []

      const options = {
        timezone,
        temperatureUnit,
        windSpeedUnit,
        precipitationUnit,
      }

      const weatherData = await weatherService.getCurrentWeather(
        Number.parseFloat(latitude),
        Number.parseFloat(longitude),
        parsedVariables,
        options,
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
        message: error.message || "Failed to fetch current weather data",
      })
    }
  },
)

// Get weather forecast with customizable variables
router.get(
  "/forecast",
  [
    query("latitude").isFloat({ min: -90, max: 90 }),
    query("longitude").isFloat({ min: -180, max: 180 }),
    query("hourlyVariables").optional().isString(),
    query("dailyVariables").optional().isString(),
    query("days").optional().isInt({ min: 1, max: 16 }),
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

      const {
        latitude,
        longitude,
        hourlyVariables,
        dailyVariables,
        days,
        timezone,
        temperatureUnit,
        windSpeedUnit,
        precipitationUnit,
      } = req.query

      const params = {
        hourlyVariables: hourlyVariables ? hourlyVariables.split(",") : [],
        dailyVariables: dailyVariables ? dailyVariables.split(",") : [],
        days: days ? Number.parseInt(days) : 7,
      }

      const options = {
        timezone,
        temperatureUnit,
        windSpeedUnit,
        precipitationUnit,
      }

      const forecastData = await weatherService.getForecast(
        Number.parseFloat(latitude),
        Number.parseFloat(longitude),
        params,
        options,
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
        message: error.message || "Failed to fetch weather forecast data",
      })
    }
  },
)

// Get historical weather with customizable variables
router.get(
  "/historical",
  [
    query("latitude").isFloat({ min: -90, max: 90 }),
    query("longitude").isFloat({ min: -180, max: 180 }),
    query("startDate").isISO8601(),
    query("endDate").isISO8601(),
    query("hourlyVariables").optional().isString(),
    query("dailyVariables").optional().isString(),
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

      const {
        latitude,
        longitude,
        startDate,
        endDate,
        hourlyVariables,
        dailyVariables,
        timezone,
        temperatureUnit,
        windSpeedUnit,
        precipitationUnit,
      } = req.query

      const params = {
        hourlyVariables: hourlyVariables ? hourlyVariables.split(",") : [],
        dailyVariables: dailyVariables ? dailyVariables.split(",") : [],
      }

      const options = {
        timezone,
        temperatureUnit,
        windSpeedUnit,
        precipitationUnit,
      }

      const historicalData = await weatherService.getHistoricalWeather(
        Number.parseFloat(latitude),
        Number.parseFloat(longitude),
        startDate,
        endDate,
        params,
        options,
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
        message: error.message || "Failed to fetch historical weather data",
      })
    }
  },
)

// Get air quality data with customizable variables
router.get(
  "/air-quality",
  [
    query("latitude").isFloat({ min: -90, max: 90 }),
    query("longitude").isFloat({ min: -180, max: 180 }),
    query("variables").optional().isString(),
    query("days").optional().isInt({ min: 1, max: 5 }),
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

      const { latitude, longitude, variables, days, timezone } = req.query

      // Parse variables if provided
      const parsedVariables = variables ? variables.split(",") : []

      const options = {
        days: days ? Number.parseInt(days) : 5,
        timezone,
      }

      const airQualityData = await weatherService.getAirQuality(
        Number.parseFloat(latitude),
        Number.parseFloat(longitude),
        parsedVariables,
        options,
      )

      res.json({
        success: true,
        message: "Air quality data retrieved successfully",
        data: airQualityData,
      })
    } catch (error) {
      logger.error("Error fetching air quality data:", error)
      res.status(500).json({
        success: false,
        message: error.message || "Failed to fetch air quality data",
      })
    }
  },
)

// Get climate projection data with customizable variables and models
router.get(
  "/climate",
  [
    query("latitude").isFloat({ min: -90, max: 90 }),
    query("longitude").isFloat({ min: -180, max: 180 }),
    query("startDate").isISO8601(),
    query("endDate").isISO8601(),
    query("variables").optional().isString(),
    query("models").optional().isString(),
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

      const {
        latitude,
        longitude,
        startDate,
        endDate,
        variables,
        models,
        timezone,
        temperatureUnit,
        windSpeedUnit,
        precipitationUnit,
      } = req.query

      const params = {
        variables: variables ? variables.split(",") : [],
        models: models ? models.split(",") : [],
      }

      const options = {
        timezone,
        temperatureUnit,
        windSpeedUnit,
        precipitationUnit,
      }

      const climateData = await weatherService.getClimateProjection(
        Number.parseFloat(latitude),
        Number.parseFloat(longitude),
        startDate,
        endDate,
        params,
        options,
      )

      res.json({
        success: true,
        message: "Climate projection data retrieved successfully",
        data: climateData,
      })
    } catch (error) {
      logger.error("Error fetching climate projection data:", error)
      res.status(500).json({
        success: false,
        message: error.message || "Failed to fetch climate projection data",
      })
    }
  },
)

export default router
