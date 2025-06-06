import express from "express"
import { query } from "express-validator"
import {
  getWeatherVariables,
  getCurrentWeather,
  getWeatherForecast,
  getHistoricalWeather,
  getClimateProjection,
} from "../controllers/weatherController.js"
import { protect } from "../middlewares/authMiddleware.js"

const router = express.Router()

// Public route for weather variables
router.get("/variables", getWeatherVariables)

// Protected weather routes
// router.use(protect)

// Get current weather with customizable variables
router.get(
  "/current",
  [
    query("latitude").isFloat({ min: -90, max: 90 }).withMessage("Valid latitude is required"),
    query("longitude").isFloat({ min: -180, max: 180 }).withMessage("Valid longitude is required"),
    query("variables").optional().isString().withMessage("Variables must be a comma-separated string"),
    query("timezone").optional().isString(),
    query("temperatureUnit").optional().isIn(["celsius", "fahrenheit"]),
    query("windSpeedUnit").optional().isIn(["kmh", "ms", "mph", "kn"]),
    query("precipitationUnit").optional().isIn(["mm", "inch"]),
  ],
  getCurrentWeather,
)

// Get weather forecast with customizable variables
router.get(
  "/forecast",
  [
    query("latitude").isFloat({ min: -90, max: 90 }).withMessage("Valid latitude is required"),
    query("longitude").isFloat({ min: -180, max: 180 }).withMessage("Valid longitude is required"),
    query("hourlyVariables").optional().isString(),
    query("dailyVariables").optional().isString(),
    query("days").optional().isInt({ min: 1, max: 16 }).withMessage("Days must be between 1 and 16"),
    query("timezone").optional().isString(),
    query("temperatureUnit").optional().isIn(["celsius", "fahrenheit"]),
    query("windSpeedUnit").optional().isIn(["kmh", "ms", "mph", "kn"]),
    query("precipitationUnit").optional().isIn(["mm", "inch"]),
  ],
  getWeatherForecast,
)

// Get historical weather with customizable variables
router.get(
  "/historical",
  [
    query("latitude").isFloat({ min: -90, max: 90 }).withMessage("Valid latitude is required"),
    query("longitude").isFloat({ min: -180, max: 180 }).withMessage("Valid longitude is required"),
    query("startDate").isISO8601().withMessage("Valid start date is required (YYYY-MM-DD)"),
    query("endDate").isISO8601().withMessage("Valid end date is required (YYYY-MM-DD)"),
    query("hourlyVariables").optional().isString(),
    query("dailyVariables").optional().isString(),
    query("timezone").optional().isString(),
    query("temperatureUnit").optional().isIn(["celsius", "fahrenheit"]),
    query("windSpeedUnit").optional().isIn(["kmh", "ms", "mph", "kn"]),
    query("precipitationUnit").optional().isIn(["mm", "inch"]),
  ],
  getHistoricalWeather,
)

// Get climate projection data with customizable variables
router.get(
  "/climate",
  [
    query("latitude").isFloat({ min: -90, max: 90 }).withMessage("Valid latitude is required"),
    query("longitude").isFloat({ min: -180, max: 180 }).withMessage("Valid longitude is required"),
    query("startDate").isISO8601().withMessage("Valid start date is required (YYYY-MM-DD)"),
    query("endDate").isISO8601().withMessage("Valid end date is required (YYYY-MM-DD)"),
    query("variables").optional().isString(),
    query("timezone").optional().isString(),
    query("temperatureUnit").optional().isIn(["celsius", "fahrenheit"]),
    query("windSpeedUnit").optional().isIn(["kmh", "ms", "mph", "kn"]),
    query("precipitationUnit").optional().isIn(["mm", "inch"]),
  ],
  getClimateProjection,
)

export default router
