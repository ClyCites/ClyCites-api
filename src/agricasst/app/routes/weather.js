import express from "express"
import {
  getCurrentWeather,
  getForecast,
  getAgriculturalMetrics,
  getWeatherAlerts,
  getHistoricalWeather,
} from "../controllers/weatherController.js"
import { validateCoordinates } from "../middleware/validation.js"
import { requireScope, requirePermission } from "../middleware/auth.js"

const router = express.Router()

// Get current weather and forecast
router.get("/current", 
  // requireScope("weather:read", "agric:read"), 
  validateCoordinates, 
  getCurrentWeather
)

// Get weather forecast
router.get("/forecast", 
  // requireScope("weather:read", "agric:read"), 
  validateCoordinates, 
  getForecast
)

// Get agricultural metrics
router.get("/agricultural-metrics", 
  // requireScope("agric:read"), 
  // requirePermission("weather", "read"),
  validateCoordinates, 
  getAgriculturalMetrics
)

// Get weather alerts
router.get("/alerts", 
  // requireScope("alerts:read", "agric:read"), 
  getWeatherAlerts
)

// Get historical weather data
router.get("/historical", 
  // requireScope("weather:read"), 
  // requirePermission("weather", "historical"),
  validateCoordinates, 
  getHistoricalWeather
)

export default router
