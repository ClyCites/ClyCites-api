import recommendationService from "../services/recommendationService.js"
import Crop from "../models/Crop.js"
import Weather from "../models/Weather.js"
import { logger } from "../utils/logger.js"
import { ApiResponse } from "../utils/apiResponse.js"

export const getCropRecommendations = async (req, res) => {
  try {
    const { lat, lon, season, farmSize, soilType } = req.query
    const userId = req.user.id

    const location = {
      latitude: Number.parseFloat(lat),
      longitude: Number.parseFloat(lon),
    }

    const options = {
      season,
      farmSize: farmSize ? Number.parseFloat(farmSize) : null,
      soilType,
    }

    const recommendations = await recommendationService.getCropRecommendations(userId, location, options)

    res.json(ApiResponse.success(recommendations, "Crop recommendations generated successfully"))
  } catch (error) {
    logger.error("Error in getCropRecommendations:", error)
    res.status(500).json(ApiResponse.error(error.message))
  }
}

export const getIrrigationRecommendations = async (req, res) => {
  try {
    const { lat, lon, cropType, plantingDate, farmSize } = req.query
    const userId = req.user.id

    if (!cropType) {
      return res.status(400).json(ApiResponse.error("Crop type is required"))
    }

    const location = {
      latitude: Number.parseFloat(lat),
      longitude: Number.parseFloat(lon),
    }

    const options = {
      plantingDate: plantingDate ? new Date(plantingDate) : null,
      farmSize: farmSize ? Number.parseFloat(farmSize) : null,
    }

    const irrigationAdvice = await recommendationService.getIrrigationRecommendations(
      userId,
      cropType,
      location,
      options,
    )

    res.json(ApiResponse.success(irrigationAdvice, "Irrigation recommendations generated successfully"))
  } catch (error) {
    logger.error("Error in getIrrigationRecommendations:", error)
    res.status(500).json(ApiResponse.error(error.message))
  }
}

export const getPlantingRecommendations = async (req, res) => {
  try {
    const { lat, lon, cropName } = req.query
    const userId = req.user.id

    if (!cropName) {
      return res.status(400).json(ApiResponse.error("Crop name is required"))
    }

    const crop = await Crop.findOne({
      $or: [{ name: new RegExp(cropName, "i") }, { commonNames: new RegExp(cropName, "i") }],
    })

    if (!crop) {
      return res.status(404).json(ApiResponse.error("Crop not found"))
    }

    const weather = await Weather.findOne({
      userId,
      "location.latitude": { $gte: Number.parseFloat(lat) - 0.1, $lte: Number.parseFloat(lat) + 0.1 },
      "location.longitude": { $gte: Number.parseFloat(lon) - 0.1, $lte: Number.parseFloat(lon) + 0.1 },
    }).sort({ "dataQuality.lastUpdated": -1 })

    if (!weather) {
      return res.status(404).json(ApiResponse.error("Weather data not available for this location"))
    }

    const plantingAdvice = recommendationService.generatePlantingAdvice(crop, weather)
    const yieldEstimate = recommendationService.estimateYield(crop, weather)
    const optimalTiming = recommendationService.getOptimalPlantingTiming(crop, weather)

    const responseData = {
      crop: {
        name: crop.name,
        scientificName: crop.scientificName,
        category: crop.category,
        difficulty: crop.difficulty,
      },
      plantingAdvice,
      yieldEstimate,
      optimalTiming,
      climaticRequirements: crop.climaticRequirements,
      currentConditions: {
        temperature: weather.current.temperature,
        humidity: weather.current.humidity,
        soilTemperature: weather.agriculturalMetrics.soilTemperature,
        lastUpdated: weather.dataQuality.lastUpdated,
      },
      riskFactors: recommendationService.assessRiskFactors(crop, weather),
    }

    res.json(ApiResponse.success(responseData, "Planting recommendations generated successfully"))
  } catch (error) {
    logger.error("Error in getPlantingRecommendations:", error)
    res.status(500).json(ApiResponse.error(error.message))
  }
}

export const getFertilizerRecommendations = async (req, res) => {
  try {
    const { cropType, growthStage, soilType, farmSize, organicPreference } = req.query

    if (!cropType || !growthStage) {
      return res.status(400).json(ApiResponse.error("Crop type and growth stage are required"))
    }

    const recommendations = await recommendationService.getFertilizerRecommendations({
      cropType,
      growthStage,
      soilType,
      farmSize: farmSize ? Number.parseFloat(farmSize) : null,
      organicPreference: organicPreference === "true",
    })

    res.json(ApiResponse.success(recommendations, "Fertilizer recommendations generated successfully"))
  } catch (error) {
    logger.error("Error in getFertilizerRecommendations:", error)
    res.status(500).json(ApiResponse.error(error.message))
  }
}

export const getPestManagementRecommendations = async (req, res) => {
  try {
    const { lat, lon, cropName, symptoms } = req.query
    const userId = req.user.id

    if (!cropName) {
      return res.status(400).json(ApiResponse.error("Crop name is required"))
    }

    const location = {
      latitude: Number.parseFloat(lat),
      longitude: Number.parseFloat(lon),
    }

    const recommendations = await recommendationService.getPestManagementRecommendations(
      userId,
      cropName,
      location,
      symptoms ? symptoms.split(",") : [],
    )

    res.json(ApiResponse.success(recommendations, "Pest management recommendations generated successfully"))
  } catch (error) {
    logger.error("Error in getPestManagementRecommendations:", error)
    res.status(500).json(ApiResponse.error(error.message))
  }
}
