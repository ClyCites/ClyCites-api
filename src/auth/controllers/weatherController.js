import { validationResult } from "express-validator"
import { weatherService } from "../services/weatherService.js"
import logger from "../utils/logger.js"
import { asyncHandler } from "../utils/asyncHandler.js"
import { AppError } from "../utils/appError.js"

// @desc    Get available weather variables
// @route   GET /api/weather/variables
// @access  Public
export const getWeatherVariables = asyncHandler(async (req, res) => {
  const variables = weatherService.getAvailableVariables()

  res.json({
    success: true,
    message: "Available weather variables retrieved successfully",
    data: variables,
  })
})

// @desc    Get current weather with customizable variables
// @route   GET /api/weather/current
// @access  Private
export const getCurrentWeather = asyncHandler(async (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return next(new AppError("Validation failed", 400, errors.array()))
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

  try {
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
    return next(new AppError(error.message || "Failed to fetch current weather data", 500))
  }
})

// @desc    Get weather forecast with customizable variables
// @route   GET /api/weather/forecast
// @access  Private
export const getWeatherForecast = asyncHandler(async (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return next(new AppError("Validation failed", 400, errors.array()))
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

  try {
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
    return next(new AppError(error.message || "Failed to fetch weather forecast data", 500))
  }
})

// @desc    Get historical weather with customizable variables
// @route   GET /api/weather/historical
// @access  Private
export const getHistoricalWeather = asyncHandler(async (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return next(new AppError("Validation failed", 400, errors.array()))
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

  try {
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
    return next(new AppError(error.message || "Failed to fetch historical weather data", 500))
  }
})

// @desc    Get climate projection data with customizable variables
// @route   GET /api/weather/climate
// @access  Private
export const getClimateProjection = asyncHandler(async (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return next(new AppError("Validation failed", 400, errors.array()))
  }

  const {
    latitude,
    longitude,
    startDate,
    endDate,
    variables,
    timezone,
    temperatureUnit,
    windSpeedUnit,
    precipitationUnit,
  } = req.query

  const params = {
    variables: variables ? variables.split(",") : [],
  }

  const options = {
    timezone,
    temperatureUnit,
    windSpeedUnit,
    precipitationUnit,
  }

  try {
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
    return next(new AppError(error.message || "Failed to fetch climate projection data", 500))
  }
})

export default {
  getWeatherVariables,
  getCurrentWeather,
  getWeatherForecast,
  getHistoricalWeather,
  getClimateProjection,
}
