import express from "express"
import {
  getCurrentWeather,
  getForecast,
  getAgriculturalMetrics,
  getWeatherAlerts,
  getHistoricalWeather,
} from "../controllers/weatherController.js"
import { validateCoordinates } from "../middleware/validation.js"

const router = express.Router()

// Get current weather and forecast
router.get("/current", validateCoordinates, getCurrentWeather)

// Get weather forecast
router.get("/forecast", validateCoordinates, getForecast)

// Get agricultural metrics
router.get("/agricultural-metrics", validateCoordinates, getAgriculturalMetrics)

// Get weather alerts
router.get("/alerts", getWeatherAlerts)

// Get historical weather data
router.get("/historical", validateCoordinates, getHistoricalWeather)

export default router
