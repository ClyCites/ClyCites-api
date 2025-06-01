import weatherService from "../services/weatherService.js"
import Weather from "../models/Weather.js"
import { logger } from "../utils/logger.js"
import { ApiResponse } from "../utils/apiResponse.js"

export const getCurrentWeather = async (req, res) => {
  try {
    const { lat, lon } = req.query
    const userId = req.user.id

    const weatherData = await weatherService.getCurrentWeather(Number.parseFloat(lat), Number.parseFloat(lon), userId)

    res.json(ApiResponse.success(weatherData, "Weather data retrieved successfully"))
  } catch (error) {
    logger.error("Error in getCurrentWeather:", error)
    res.status(500).json(ApiResponse.error(error.message))
  }
}

export const getForecast = async (req, res) => {
  try {
    const { lat, lon, days = 7 } = req.query

    const forecast = await weatherService.fetchForecast(Number.parseFloat(lat), Number.parseFloat(lon))

    res.json(ApiResponse.success(forecast.slice(0, Number.parseInt(days)), "Forecast data retrieved successfully"))
  } catch (error) {
    logger.error("Error in getForecast:", error)
    res.status(500).json(ApiResponse.error(error.message))
  }
}

export const getAgriculturalMetrics = async (req, res) => {
  try {
    const { lat, lon } = req.query
    const userId = req.user.id

    const weatherData = await Weather.findOne({
      userId,
      "location.latitude": { $gte: Number.parseFloat(lat) - 0.1, $lte: Number.parseFloat(lat) + 0.1 },
      "location.longitude": { $gte: Number.parseFloat(lon) - 0.1, $lte: Number.parseFloat(lon) + 0.1 },
    }).sort({ "dataQuality.lastUpdated": -1 })

    if (!weatherData) {
      return res.status(404).json(ApiResponse.error("No weather data found for this location"))
    }

    const responseData = {
      agriculturalMetrics: weatherData.agriculturalMetrics,
      alerts: weatherData.alerts.filter((alert) => alert.isActive),
      location: weatherData.location,
      lastUpdated: weatherData.dataQuality.lastUpdated,
      dataQuality: weatherData.dataQuality,
    }

    res.json(ApiResponse.success(responseData, "Agricultural metrics retrieved successfully"))
  } catch (error) {
    logger.error("Error in getAgriculturalMetrics:", error)
    res.status(500).json(ApiResponse.error(error.message))
  }
}

export const getWeatherAlerts = async (req, res) => {
  try {
    const userId = req.user.id
    const { lat, lon, severity } = req.query

    const query = {
      userId,
      "alerts.isActive": true,
      "alerts.endTime": { $gt: new Date() },
    }

    if (lat && lon) {
      query["location.latitude"] = { $gte: Number.parseFloat(lat) - 0.1, $lte: Number.parseFloat(lat) + 0.1 }
      query["location.longitude"] = { $gte: Number.parseFloat(lon) - 0.1, $lte: Number.parseFloat(lon) + 0.1 }
    }

    const weatherData = await Weather.find(query).sort({ "dataQuality.lastUpdated": -1 }).limit(10)

    let allAlerts = weatherData.reduce((alerts, weather) => {
      const activeAlerts = weather.alerts
        .filter((alert) => alert.isActive && new Date(alert.endTime) > new Date())
        .map((alert) => ({
          ...alert.toObject(),
          location: weather.location,
          weatherId: weather._id,
        }))
      return alerts.concat(activeAlerts)
    }, [])

    // Filter by severity if specified
    if (severity) {
      allAlerts = allAlerts.filter((alert) => alert.severity === severity)
    }

    // Sort by severity and start time
    const severityOrder = { critical: 4, high: 3, moderate: 2, low: 1 }
    allAlerts.sort((a, b) => {
      const severityDiff = severityOrder[b.severity] - severityOrder[a.severity]
      if (severityDiff !== 0) return severityDiff
      return new Date(a.startTime) - new Date(b.startTime)
    })

    res.json(ApiResponse.success(allAlerts, "Weather alerts retrieved successfully"))
  } catch (error) {
    logger.error("Error in getWeatherAlerts:", error)
    res.status(500).json(ApiResponse.error(error.message))
  }
}

export const getHistoricalWeather = async (req, res) => {
  try {
    const { lat, lon, startDate, endDate } = req.query

    if (!startDate || !endDate) {
      return res.status(400).json(ApiResponse.error("Start date and end date are required"))
    }

    const historicalData = await weatherService.getHistoricalWeather(
      Number.parseFloat(lat),
      Number.parseFloat(lon),
      new Date(startDate),
      new Date(endDate),
    )

    res.json(ApiResponse.success(historicalData, "Historical weather data retrieved successfully"))
  } catch (error) {
    logger.error("Error in getHistoricalWeather:", error)
    res.status(500).json(ApiResponse.error(error.message))
  }
}
