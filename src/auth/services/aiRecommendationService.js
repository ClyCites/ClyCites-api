import { generateText } from "ai"
import { openai } from "@ai-sdk/openai"
import AIRecommendation from "../models/aiRecommendationModel.js"
import Farm from "../models/farmModel.js"
import Crop from "../models/cropModel.js"
import AgricultureActivity from "../models/agricultureActivityModel.js"
import { weatherService } from "./weatherService.js"
import logger from "../utils/logger.js"

class AIRecommendationService {
  constructor() {
    this.model = openai("gpt-4o")
  }

  /**
   * Generate comprehensive AI recommendations for a farm
   * @param {string} farmId - Farm ID
   * @param {string} userId - User ID
   * @returns {Promise<Array>} Array of recommendations
   */
  async generateFarmRecommendations(farmId, userId) {
    try {
      const farm = await Farm.findById(farmId).populate("owner")
      if (!farm) {
        throw new Error("Farm not found")
      }

      // Get current crops
      const crops = await Crop.find({ farm: farmId, status: { $in: ["planted", "growing"] } })

      // Get recent activities
      const recentActivities = await AgricultureActivity.find({ farm: farmId })
        .sort({ actualDate: -1 })
        .limit(20)
        .populate("crop")

      // Get current weather
      const currentWeather = await weatherService.getCurrentWeather(farm.location.latitude, farm.location.longitude, [
        "temperature_2m",
        "relative_humidity_2m",
        "precipitation",
        "wind_speed_10m",
        "soil_moisture_0_1cm",
        "soil_moisture_1_3cm",
        "evapotranspiration",
      ])

      // Get 7-day forecast
      const forecast = await weatherService.getForecast(farm.location.latitude, farm.location.longitude, {
        dailyVariables: ["temperature_2m_max", "temperature_2m_min", "precipitation_sum", "et0_fao_evapotranspiration"],
        days: 7,
      })

      const recommendations = []

      // Generate weather-based recommendations
      const weatherRecommendations = await this.generateWeatherRecommendations(
        farm,
        crops,
        currentWeather,
        forecast,
        userId,
      )
      recommendations.push(...weatherRecommendations)

      // Generate crop-specific recommendations
      for (const crop of crops) {
        const cropRecommendations = await this.generateCropRecommendations(farm, crop, currentWeather, forecast, userId)
        recommendations.push(...cropRecommendations)
      }

      // Generate irrigation recommendations
      const irrigationRecommendations = await this.generateIrrigationRecommendations(
        farm,
        crops,
        currentWeather,
        forecast,
        userId,
      )
      recommendations.push(...irrigationRecommendations)

      // Save recommendations to database
      const savedRecommendations = []
      for (const rec of recommendations) {
        try {
          const saved = await AIRecommendation.create(rec)
          savedRecommendations.push(saved)
        } catch (error) {
          logger.error("Error saving recommendation:", error)
        }
      }

      return savedRecommendations
    } catch (error) {
      logger.error("Error generating farm recommendations:", error)
      throw new Error(`Failed to generate recommendations: ${error.message}`)
    }
  }

  /**
   * Generate weather-based recommendations
   */
  async generateWeatherRecommendations(farm, crops, currentWeather, forecast, userId) {
    const recommendations = []

    try {
      const weatherContext = {
        current: currentWeather.data,
        forecast: forecast.daily.slice(0, 3), // Next 3 days
        location: farm.location,
        farmType: farm.farmType,
        crops: crops.map((c) => ({ name: c.name, category: c.category, growthStage: c.growthStage })),
      }

      const prompt = `
        As an agricultural AI assistant, analyze the weather data and provide specific recommendations for this farm:
        
        Farm Details:
        - Type: ${farm.farmType}
        - Size: ${farm.size.value} ${farm.size.unit}
        - Soil Type: ${farm.soilType || "Unknown"}
        - Irrigation: ${farm.irrigationSystem}
        
        Current Weather:
        - Temperature: ${currentWeather.data.temperature_2m}°C
        - Humidity: ${currentWeather.data.relative_humidity_2m}%
        - Precipitation: ${currentWeather.data.precipitation}mm
        - Soil Moisture: ${currentWeather.data.soil_moisture_0_1cm}%
        
        3-Day Forecast:
        ${forecast.daily
          .slice(0, 3)
          .map(
            (day, i) =>
              `Day ${i + 1}: ${day.data.temperature_2m_min}-${day.data.temperature_2m_max}°C, Rain: ${day.data.precipitation_sum}mm`,
          )
          .join("\n")}
        
        Active Crops:
        ${crops.map((c) => `- ${c.name} (${c.category}, ${c.growthStage} stage)`).join("\n")}
        
        Provide 2-3 specific, actionable weather-related recommendations. Focus on:
        1. Immediate weather threats or opportunities
        2. Irrigation adjustments needed
        3. Protective measures for crops
        
        Format each recommendation as:
        TITLE: [Brief title]
        PRIORITY: [low/medium/high/critical]
        ACTION: [Specific action needed]
        TIMEFRAME: [When to act]
        REASON: [Why this is important]
      `

      const { text } = await generateText({
        model: this.model,
        prompt,
        maxTokens: 1000,
      })

      // Parse AI response and create recommendation objects
      const parsedRecommendations = this.parseAIRecommendations(text, farm._id, userId, "weather_alert")
      recommendations.push(...parsedRecommendations)

      // Check for specific weather alerts
      if (currentWeather.data.precipitation > 20) {
        recommendations.push({
          farm: farm._id,
          user: userId,
          type: "weather_alert",
          priority: "high",
          title: "Heavy Rainfall Alert",
          description: `Heavy rainfall detected (${currentWeather.data.precipitation}mm). Take protective measures for crops and ensure proper drainage.`,
          actionRequired: true,
          recommendedAction: "Check drainage systems, protect sensitive crops, delay irrigation",
          timeframe: "immediate",
          confidence: 95,
          dataSource: {
            weather: true,
            soilData: false,
            cropStage: false,
            historicalData: false,
            marketData: false,
            satelliteImagery: false,
          },
          weatherContext: {
            currentConditions: currentWeather.data,
            forecast: forecast.daily.slice(0, 3),
            alerts: ["heavy_rainfall"],
          },
          aiModel: {
            name: "ClyCites-Weather-AI",
            version: "1.0",
          },
        })
      }

      if (currentWeather.data.temperature_2m > 35) {
        recommendations.push({
          farm: farm._id,
          user: userId,
          type: "weather_alert",
          priority: "high",
          title: "High Temperature Alert",
          description: `Extreme temperature detected (${currentWeather.data.temperature_2m}°C). Crops may be stressed and require additional water.`,
          actionRequired: true,
          recommendedAction:
            "Increase irrigation frequency, provide shade for sensitive crops, monitor for heat stress",
          timeframe: "immediate",
          confidence: 90,
          dataSource: {
            weather: true,
            soilData: false,
            cropStage: true,
            historicalData: false,
            marketData: false,
            satelliteImagery: false,
          },
          weatherContext: {
            currentConditions: currentWeather.data,
            forecast: forecast.daily.slice(0, 3),
            alerts: ["high_temperature"],
          },
          aiModel: {
            name: "ClyCites-Weather-AI",
            version: "1.0",
          },
        })
      }
    } catch (error) {
      logger.error("Error generating weather recommendations:", error)
    }

    return recommendations
  }

  /**
   * Generate crop-specific recommendations
   */
  async generateCropRecommendations(farm, crop, currentWeather, forecast, userId) {
    const recommendations = []

    try {
      const cropAge = crop.ageInDays
      const daysToHarvest = crop.daysToHarvest

      const prompt = `
        As an agricultural AI assistant, provide specific recommendations for this crop:
        
        Crop Details:
        - Name: ${crop.name}
        - Category: ${crop.category}
        - Variety: ${crop.variety || "Unknown"}
        - Growth Stage: ${crop.growthStage}
        - Age: ${cropAge} days
        - Days to Harvest: ${daysToHarvest || "Unknown"}
        - Field Size: ${crop.field.area?.value || "Unknown"} ${crop.field.area?.unit || ""}
        
        Current Weather:
        - Temperature: ${currentWeather.data.temperature_2m}°C
        - Humidity: ${currentWeather.data.relative_humidity_2m}%
        - Soil Moisture: ${currentWeather.data.soil_moisture_0_1cm}%
        
        Provide 1-2 specific recommendations for this crop based on its growth stage and current conditions.
        Focus on:
        1. Growth stage-specific care
        2. Pest/disease prevention
        3. Nutrition requirements
        4. Harvest timing
        
        Format each recommendation as:
        TITLE: [Brief title]
        PRIORITY: [low/medium/high/critical]
        ACTION: [Specific action needed]
        TIMEFRAME: [When to act]
        REASON: [Why this is important]
      `

      const { text } = await generateText({
        model: this.model,
        prompt,
        maxTokens: 800,
      })

      const parsedRecommendations = this.parseAIRecommendations(text, farm._id, userId, "general", crop._id)
      recommendations.push(...parsedRecommendations)

      // Check for harvest timing
      if (daysToHarvest && daysToHarvest <= 7 && daysToHarvest > 0) {
        recommendations.push({
          farm: farm._id,
          crop: crop._id,
          user: userId,
          type: "harvest_timing",
          priority: "high",
          title: `${crop.name} Harvest Approaching`,
          description: `Your ${crop.name} crop is expected to be ready for harvest in ${daysToHarvest} days. Prepare harvesting equipment and labor.`,
          actionRequired: true,
          recommendedAction: "Prepare harvesting equipment, arrange labor, check market prices",
          timeframe: "within_week",
          confidence: 85,
          dataSource: {
            weather: true,
            soilData: false,
            cropStage: true,
            historicalData: false,
            marketData: false,
            satelliteImagery: false,
          },
          weatherContext: {
            currentConditions: currentWeather.data,
            forecast: forecast.daily.slice(0, 7),
          },
          aiModel: {
            name: "ClyCites-Crop-AI",
            version: "1.0",
          },
        })
      }

      // Growth stage specific recommendations
      if (crop.growthStage === "flowering" && currentWeather.data.relative_humidity_2m > 80) {
        recommendations.push({
          farm: farm._id,
          crop: crop._id,
          user: userId,
          type: "disease_prevention",
          priority: "medium",
          title: "Fungal Disease Risk During Flowering",
          description: `High humidity (${currentWeather.data.relative_humidity_2m}%) during flowering stage increases fungal disease risk for ${crop.name}.`,
          actionRequired: true,
          recommendedAction: "Apply preventive fungicide, improve air circulation, monitor for disease symptoms",
          timeframe: "within_24h",
          confidence: 80,
          dataSource: {
            weather: true,
            soilData: false,
            cropStage: true,
            historicalData: false,
            marketData: false,
            satelliteImagery: false,
          },
          weatherContext: {
            currentConditions: currentWeather.data,
          },
          aiModel: {
            name: "ClyCites-Disease-AI",
            version: "1.0",
          },
        })
      }
    } catch (error) {
      logger.error("Error generating crop recommendations:", error)
    }

    return recommendations
  }

  /**
   * Generate irrigation recommendations
   */
  async generateIrrigationRecommendations(farm, crops, currentWeather, forecast, userId) {
    const recommendations = []

    try {
      const soilMoisture = currentWeather.data.soil_moisture_0_1cm || 50
      const evapotranspiration = currentWeather.data.evapotranspiration || 0
      const upcomingRain = forecast.daily.slice(0, 3).reduce((sum, day) => sum + (day.data.precipitation_sum || 0), 0)

      // Calculate irrigation need
      let irrigationNeed = "none"
      let priority = "low"

      if (soilMoisture < 30) {
        irrigationNeed = "urgent"
        priority = "high"
      } else if (soilMoisture < 50 && upcomingRain < 10) {
        irrigationNeed = "moderate"
        priority = "medium"
      } else if (upcomingRain > 20) {
        irrigationNeed = "delay"
        priority = "low"
      }

      if (irrigationNeed !== "none") {
        const prompt = `
          As an irrigation specialist AI, provide specific irrigation recommendations:
          
          Current Conditions:
          - Soil Moisture: ${soilMoisture}%
          - Evapotranspiration: ${evapotranspiration}mm
          - Temperature: ${currentWeather.data.temperature_2m}°C
          - Expected Rain (3 days): ${upcomingRain}mm
          
          Farm Details:
          - Irrigation System: ${farm.irrigationSystem}
          - Farm Size: ${farm.size.value} ${farm.size.unit}
          - Soil Type: ${farm.soilType || "Unknown"}
          
          Active Crops:
          ${crops.map((c) => `- ${c.name} (${c.growthStage} stage)`).join("\n")}
          
          Irrigation Need Assessment: ${irrigationNeed}
          
          Provide specific irrigation recommendations including:
          1. When to irrigate
          2. How much water to apply
          3. Which crops to prioritize
          4. Water conservation tips
          
          Format as:
          TITLE: [Brief title]
          PRIORITY: [low/medium/high/critical]
          ACTION: [Specific action needed]
          TIMEFRAME: [When to act]
          REASON: [Why this is important]
        `

        const { text } = await generateText({
          model: this.model,
          prompt,
          maxTokens: 600,
        })

        const parsedRecommendations = this.parseAIRecommendations(text, farm._id, userId, "irrigation")
        recommendations.push(...parsedRecommendations)
      }

      // Specific irrigation alerts
      if (soilMoisture < 25) {
        recommendations.push({
          farm: farm._id,
          user: userId,
          type: "irrigation",
          priority: "critical",
          title: "Critical Soil Moisture Level",
          description: `Soil moisture is critically low at ${soilMoisture}%. Immediate irrigation required to prevent crop stress.`,
          actionRequired: true,
          recommendedAction: `Apply ${farm.irrigationSystem === "drip" ? "2-3 hours" : "20-30mm"} of water immediately`,
          timeframe: "immediate",
          confidence: 95,
          dataSource: {
            weather: true,
            soilData: true,
            cropStage: true,
            historicalData: false,
            marketData: false,
            satelliteImagery: false,
          },
          weatherContext: {
            currentConditions: currentWeather.data,
            forecast: forecast.daily.slice(0, 3),
          },
          economicImpact: {
            potentialLoss: farm.size.value * 1000, // Estimated loss per hectare
            costOfAction: farm.size.value * 50, // Estimated irrigation cost
            roi: 95, // High ROI for preventing crop loss
          },
          aiModel: {
            name: "ClyCites-Irrigation-AI",
            version: "1.0",
          },
        })
      }

      if (upcomingRain > 25) {
        recommendations.push({
          farm: farm._id,
          user: userId,
          type: "irrigation",
          priority: "medium",
          title: "Delay Irrigation - Heavy Rain Expected",
          description: `Heavy rainfall expected (${upcomingRain}mm over 3 days). Delay scheduled irrigation to avoid waterlogging.`,
          actionRequired: true,
          recommendedAction: "Cancel/delay irrigation for 3-4 days, ensure proper drainage",
          timeframe: "immediate",
          confidence: 90,
          dataSource: {
            weather: true,
            soilData: false,
            cropStage: false,
            historicalData: false,
            marketData: false,
            satelliteImagery: false,
          },
          weatherContext: {
            currentConditions: currentWeather.data,
            forecast: forecast.daily.slice(0, 3),
          },
          economicImpact: {
            potentialGain: farm.size.value * 30, // Water cost savings
            costOfAction: 0,
            roi: 100,
          },
          aiModel: {
            name: "ClyCites-Irrigation-AI",
            version: "1.0",
          },
        })
      }
    } catch (error) {
      logger.error("Error generating irrigation recommendations:", error)
    }

    return recommendations
  }

  /**
   * Parse AI-generated text into recommendation objects
   */
  parseAIRecommendations(text, farmId, userId, type, cropId = null) {
    const recommendations = []

    try {
      // Split text into sections based on "TITLE:" markers
      const sections = text.split("TITLE:").filter((section) => section.trim().length > 0)

      for (const section of sections) {
        const lines = section.split("\n").map((line) => line.trim())

        const title = lines[0]?.replace(/^\d+\.?\s*/, "").trim()
        if (!title) continue

        let priority = "medium"
        let action = ""
        let timeframe = "within_week"
        let reason = ""

        for (const line of lines) {
          if (line.startsWith("PRIORITY:")) {
            priority = line.replace("PRIORITY:", "").trim().toLowerCase()
          } else if (line.startsWith("ACTION:")) {
            action = line.replace("ACTION:", "").trim()
          } else if (line.startsWith("TIMEFRAME:")) {
            timeframe = line.replace("TIMEFRAME:", "").trim().toLowerCase().replace(/\s+/g, "_")
          } else if (line.startsWith("REASON:")) {
            reason = line.replace("REASON:", "").trim()
          }
        }

        if (title && action) {
          recommendations.push({
            farm: farmId,
            crop: cropId,
            user: userId,
            type,
            priority: ["low", "medium", "high", "critical"].includes(priority) ? priority : "medium",
            title: title.substring(0, 200),
            description: reason || action,
            actionRequired: true,
            recommendedAction: action.substring(0, 500),
            timeframe: ["immediate", "within_24h", "within_week", "within_month", "seasonal"].includes(timeframe)
              ? timeframe
              : "within_week",
            confidence: 75,
            dataSource: {
              weather: true,
              soilData: false,
              cropStage: type === "general",
              historicalData: false,
              marketData: false,
              satelliteImagery: false,
            },
            aiModel: {
              name: "ClyCites-AI-Assistant",
              version: "1.0",
            },
          })
        }
      }
    } catch (error) {
      logger.error("Error parsing AI recommendations:", error)
    }

    return recommendations
  }

  /**
   * Get active recommendations for a farm
   */
  async getActiveRecommendations(farmId, userId, filters = {}) {
    try {
      const query = {
        farm: farmId,
        user: userId,
        status: "active",
        expiresAt: { $gt: new Date() },
      }

      if (filters.type) {
        query.type = filters.type
      }

      if (filters.priority) {
        query.priority = filters.priority
      }

      const recommendations = await AIRecommendation.find(query)
        .populate("farm", "name location")
        .populate("crop", "name category growthStage")
        .sort({ priority: -1, createdAt: -1 })
        .limit(filters.limit || 50)

      return recommendations
    } catch (error) {
      logger.error("Error fetching active recommendations:", error)
      throw new Error(`Failed to fetch recommendations: ${error.message}`)
    }
  }

  /**
   * Update recommendation status
   */
  async updateRecommendationStatus(recommendationId, userId, status, feedback = null) {
    try {
      const recommendation = await AIRecommendation.findOne({
        _id: recommendationId,
        user: userId,
      })

      if (!recommendation) {
        throw new Error("Recommendation not found")
      }

      recommendation.status = status

      if (feedback) {
        recommendation.userFeedback = {
          ...recommendation.userFeedback,
          ...feedback,
        }
      }

      await recommendation.save()
      return recommendation
    } catch (error) {
      logger.error("Error updating recommendation status:", error)
      throw new Error(`Failed to update recommendation: ${error.message}`)
    }
  }

  /**
   * Generate market-based recommendations
   */
  async generateMarketRecommendations(farmId, userId) {
    // This would integrate with market data APIs
    // For now, return placeholder recommendations
    return []
  }
}

export const aiRecommendationService = new AIRecommendationService()
