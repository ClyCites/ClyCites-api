import { weatherService } from "./weather.service.js"
import { logger } from "../utils/logger.js"

class AIRecommendationService {
  async generateDailyRecommendations(farm) {
    try {
      // Get current weather and 7-day forecast
      const currentWeather = await weatherService.getCurrentWeather(farm.location.latitude, farm.location.longitude)
      const forecast = await weatherService.getForecast(farm.location.latitude, farm.location.longitude, 7)

      const recommendations = []

      // Generate recommendations for each crop
      for (const crop of farm.crops) {
        const cropRecommendations = await this.generateCropRecommendations(crop, currentWeather, forecast, farm)
        recommendations.push(...cropRecommendations)
      }

      // Generate general farm recommendations
      const generalRecommendations = await this.generateGeneralRecommendations(currentWeather, forecast, farm)
      recommendations.push(...generalRecommendations)

      // Sort by priority
      return recommendations.sort((a, b) => {
        const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 }
        return priorityOrder[b.priority] - priorityOrder[a.priority]
      })
    } catch (error) {
      logger.error("Error generating recommendations:", error)
      throw new Error("Failed to generate recommendations")
    }
  }

  async generateCropRecommendations(crop, currentWeather, forecast, farm) {
    const recommendations = []

    // Irrigation recommendations
    const irrigationRec = this.getIrrigationRecommendation(crop, currentWeather, forecast, farm)
    if (irrigationRec) recommendations.push(irrigationRec)

    // Planting recommendations
    if (crop.stage === "planning") {
      const plantingRec = this.getPlantingRecommendation(crop, currentWeather, forecast, farm)
      if (plantingRec) recommendations.push(plantingRec)
    }

    // Harvesting recommendations
    if (crop.stage === "growing" && crop.harvestDate) {
      const harvestRec = this.getHarvestingRecommendation(crop, currentWeather, forecast, farm)
      if (harvestRec) recommendations.push(harvestRec)
    }

    // Spraying recommendations
    const sprayingRec = this.getSprayingRecommendation(crop, currentWeather, forecast, farm)
    if (sprayingRec) recommendations.push(sprayingRec)

    return recommendations
  }

  getIrrigationRecommendation(crop, currentWeather, forecast, farm) {
    const totalPrecipitation = forecast.slice(0, 3).reduce((sum, day) => sum + day.data.precipitation, 0)
    const avgTemperature = forecast.slice(0, 3).reduce((sum, day) => sum + day.data.temperature, 0) / 3
    const avgHumidity = forecast.slice(0, 3).reduce((sum, day) => sum + day.data.humidity, 0) / 3

    // Irrigation logic based on crop type, weather, and soil
    const needsIrrigation = this.calculateIrrigationNeed(
      crop,
      totalPrecipitation,
      avgTemperature,
      avgHumidity,
      farm.soilType,
    )

    if (needsIrrigation.needed) {
      return {
        id: `irrigation-${crop.type}-${Date.now()}`,
        type: "irrigation",
        priority: needsIrrigation.priority,
        title: `Irrigation needed for ${crop.type}`,
        description: `Your ${crop.type} crop requires irrigation based on current weather conditions.`,
        action: `Apply ${needsIrrigation.amount}mm of water ${needsIrrigation.timing}`,
        reasoning: needsIrrigation.reasoning,
        timing: {
          recommended: needsIrrigation.when,
          deadline: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days
        },
        conditions: {
          weather: `${avgTemperature.toFixed(1)}°C, ${totalPrecipitation.toFixed(1)}mm rain expected`,
          crop: `${crop.type} - ${crop.stage}`,
          season: this.getCurrentSeason(),
        },
      }
    }

    return null
  }

  getPlantingRecommendation(crop, currentWeather, forecast, farm) {
    const plantingConditions = this.evaluatePlantingConditions(crop, currentWeather, forecast, farm)

    if (plantingConditions.suitable) {
      return {
        id: `planting-${crop.type}-${Date.now()}`,
        type: "planting",
        priority: plantingConditions.priority,
        title: `Optimal planting time for ${crop.type}`,
        description: `Weather conditions are favorable for planting ${crop.type}.`,
        action: plantingConditions.action,
        reasoning: plantingConditions.reasoning,
        timing: {
          recommended: plantingConditions.when,
          deadline: plantingConditions.deadline,
        },
        conditions: {
          weather: plantingConditions.weatherSummary,
          crop: `${crop.type} - ${crop.variety || "standard variety"}`,
          season: this.getCurrentSeason(),
        },
      }
    }

    return null
  }

  getHarvestingRecommendation(crop, currentWeather, forecast, farm) {
    const daysToHarvest = Math.ceil((new Date(crop.harvestDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))

    if (daysToHarvest <= 7) {
      const harvestConditions = this.evaluateHarvestConditions(crop, currentWeather, forecast)

      return {
        id: `harvest-${crop.type}-${Date.now()}`,
        type: "harvesting",
        priority: daysToHarvest <= 3 ? "urgent" : "high",
        title: `Harvest ${crop.type} soon`,
        description: `Your ${crop.type} is ready for harvest in ${daysToHarvest} days.`,
        action: harvestConditions.action,
        reasoning: harvestConditions.reasoning,
        timing: {
          recommended: harvestConditions.when,
          deadline: new Date(crop.harvestDate),
        },
        conditions: {
          weather: harvestConditions.weatherSummary,
          crop: `${crop.type} - ready for harvest`,
          season: this.getCurrentSeason(),
        },
      }
    }

    return null
  }

  getSprayingRecommendation(crop, currentWeather, forecast, farm) {
    const sprayingConditions = this.evaluateSprayingConditions(crop, currentWeather, forecast)

    if (sprayingConditions.recommended) {
      return {
        id: `spraying-${crop.type}-${Date.now()}`,
        type: "spraying",
        priority: sprayingConditions.priority,
        title: `Spraying recommended for ${crop.type}`,
        description: sprayingConditions.description,
        action: sprayingConditions.action,
        reasoning: sprayingConditions.reasoning,
        timing: {
          recommended: sprayingConditions.when,
          deadline: sprayingConditions.deadline,
        },
        conditions: {
          weather: sprayingConditions.weatherSummary,
          crop: `${crop.type} - ${crop.stage}`,
          season: this.getCurrentSeason(),
        },
      }
    }

    return null
  }

  async generateGeneralRecommendations(currentWeather, forecast, farm) {
    const recommendations = []

    // Weather alert recommendations
    const weatherAlerts = this.checkWeatherAlerts(currentWeather, forecast)
    recommendations.push(...weatherAlerts)

    // Seasonal recommendations
    const seasonalRec = this.getSeasonalRecommendations(farm)
    if (seasonalRec) recommendations.push(seasonalRec)

    return recommendations
  }

  calculateIrrigationNeed(crop, precipitation, temperature, humidity, soilType) {
    // Crop water requirements (mm/day)
    const cropWaterNeeds = {
      maize: 5.0,
      beans: 3.5,
      coffee: 4.0,
      banana: 6.0,
      cassava: 2.5,
      sweet_potato: 3.0,
      rice: 8.0,
      wheat: 4.5,
      tomato: 5.5,
      onion: 4.0,
      cabbage: 4.5,
    }

    const dailyNeed = cropWaterNeeds[crop.type] || 4.0
    const soilRetention = this.getSoilWaterRetention(soilType)
    const evapotranspiration = this.calculateEvapotranspiration(temperature, humidity)

    const totalNeed = (dailyNeed + evapotranspiration) * 3 // 3-day period
    const deficit = Math.max(0, totalNeed - precipitation - soilRetention)

    if (deficit > 10) {
      return {
        needed: true,
        amount: Math.round(deficit),
        priority: deficit > 20 ? "high" : "medium",
        timing: temperature > 30 ? "early morning or evening" : "during cooler hours",
        when: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
        reasoning: `Water deficit of ${deficit.toFixed(1)}mm detected. Low rainfall (${precipitation.toFixed(1)}mm) and high evapotranspiration (${evapotranspiration.toFixed(1)}mm/day) require irrigation.`,
      }
    }

    return { needed: false }
  }

  evaluatePlantingConditions(crop, currentWeather, forecast, farm) {
    const avgTemp = forecast.slice(0, 5).reduce((sum, day) => sum + day.data.temperature, 0) / 5
    const totalRain = forecast.slice(0, 5).reduce((sum, day) => sum + day.data.precipitation, 0)

    // Optimal planting conditions by crop
    const plantingConditions = {
      maize: { minTemp: 18, maxTemp: 35, minRain: 10, maxRain: 50 },
      beans: { minTemp: 15, maxTemp: 30, minRain: 15, maxRain: 40 },
      coffee: { minTemp: 20, maxTemp: 28, minRain: 20, maxRain: 60 },
      tomato: { minTemp: 18, maxTemp: 32, minRain: 5, maxRain: 30 },
    }

    const conditions = plantingConditions[crop.type] || plantingConditions.maize
    const tempOk = avgTemp >= conditions.minTemp && avgTemp <= conditions.maxTemp
    const rainOk = totalRain >= conditions.minRain && totalRain <= conditions.maxRain

    return {
      suitable: tempOk && rainOk,
      priority: tempOk && rainOk ? "high" : "medium",
      action: `Plant ${crop.type} seeds with proper spacing and depth`,
      reasoning: `Temperature (${avgTemp.toFixed(1)}°C) and rainfall (${totalRain.toFixed(1)}mm) are within optimal range`,
      when: new Date(Date.now() + 24 * 60 * 60 * 1000),
      deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      weatherSummary: `${avgTemp.toFixed(1)}°C avg, ${totalRain.toFixed(1)}mm rain expected`,
    }
  }

  evaluateHarvestConditions(crop, currentWeather, forecast) {
    const rainInNext3Days = forecast.slice(0, 3).reduce((sum, day) => sum + day.data.precipitation, 0)
    const avgHumidity = forecast.slice(0, 3).reduce((sum, day) => sum + day.data.humidity, 0) / 3

    const dryConditions = rainInNext3Days < 5 && avgHumidity < 70

    return {
      action: dryConditions ? "Harvest immediately during dry weather" : "Wait for drier conditions before harvesting",
      reasoning: dryConditions
        ? "Dry conditions are ideal for harvesting to prevent crop damage and ensure quality"
        : `High humidity (${avgHumidity.toFixed(1)}%) and rain (${rainInNext3Days.toFixed(1)}mm) may affect crop quality`,
      when: dryConditions ? new Date(Date.now() + 12 * 60 * 60 * 1000) : new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      weatherSummary: `${rainInNext3Days.toFixed(1)}mm rain, ${avgHumidity.toFixed(1)}% humidity expected`,
    }
  }

  evaluateSprayingConditions(crop, currentWeather, forecast) {
    const windSpeed = currentWeather.data.windSpeed
    const rainNext24h = forecast[0]?.data.precipitation || 0
    const temperature = currentWeather.data.temperature
    const humidity = currentWeather.data.humidity

    // Ideal spraying conditions
    const windOk = windSpeed < 10 // km/h
    const rainOk = rainNext24h < 2 // mm
    const tempOk = temperature > 15 && temperature < 30 // °C
    const humidityOk = humidity > 40 && humidity < 85 // %

    const conditions = [windOk, rainOk, tempOk, humidityOk]
    const favorableConditions = conditions.filter(Boolean).length

    if (favorableConditions >= 3) {
      return {
        recommended: true,
        priority: "medium",
        description: "Weather conditions are favorable for spraying",
        action: "Apply pesticides or fertilizers as needed",
        reasoning: `Good conditions: low wind (${windSpeed}km/h), minimal rain (${rainNext24h}mm), suitable temperature (${temperature}°C)`,
        when: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now
        deadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
        weatherSummary: `${temperature}°C, ${windSpeed}km/h wind, ${rainNext24h}mm rain expected`,
      }
    }

    return { recommended: false }
  }

  checkWeatherAlerts(currentWeather, forecast) {
    const alerts = []

    // Check for extreme temperatures
    const maxTemp = Math.max(...forecast.slice(0, 3).map((day) => day.data.temperature))
    const minTemp = Math.min(...forecast.slice(0, 3).map((day) => day.data.temperature))

    if (maxTemp > 35) {
      alerts.push({
        id: `heat-alert-${Date.now()}`,
        type: "general",
        priority: "high",
        title: "Heat wave warning",
        description: `Extreme heat expected (${maxTemp}°C). Take protective measures.`,
        action: "Increase irrigation, provide shade for sensitive crops, harvest early if possible",
        reasoning: "High temperatures can stress crops and reduce yields",
        timing: {
          recommended: new Date(),
          deadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
        conditions: {
          weather: `Max temperature: ${maxTemp}°C`,
          crop: "All crops",
          season: this.getCurrentSeason(),
        },
      })
    }

    if (minTemp < 5) {
      alerts.push({
        id: `frost-alert-${Date.now()}`,
        type: "general",
        priority: "urgent",
        title: "Frost warning",
        description: `Frost risk detected (${minTemp}°C). Protect sensitive crops.`,
        action: "Cover sensitive plants, use frost protection methods, harvest mature crops",
        reasoning: "Frost can severely damage or kill crops",
        timing: {
          recommended: new Date(),
          deadline: new Date(Date.now() + 12 * 60 * 60 * 1000),
        },
        conditions: {
          weather: `Min temperature: ${minTemp}°C`,
          crop: "All crops",
          season: this.getCurrentSeason(),
        },
      })
    }

    // Check for heavy rain
    const heavyRain = forecast.find((day) => day.data.precipitation > 50)
    if (heavyRain) {
      alerts.push({
        id: `rain-alert-${Date.now()}`,
        type: "general",
        priority: "medium",
        title: "Heavy rainfall expected",
        description: `Heavy rain forecast (${heavyRain.data.precipitation}mm). Prepare for potential flooding.`,
        action: "Ensure proper drainage, delay spraying, protect harvested crops",
        reasoning: "Heavy rainfall can cause waterlogging and crop damage",
        timing: {
          recommended: new Date(),
          deadline: new Date(heavyRain.timestamp),
        },
        conditions: {
          weather: `${heavyRain.data.precipitation}mm rain expected`,
          crop: "All crops",
          season: this.getCurrentSeason(),
        },
      })
    }

    return alerts
  }

  getSeasonalRecommendations(farm) {
    const season = this.getCurrentSeason()
    const month = new Date().getMonth()

    // East African seasonal recommendations
    if (season === "dry" && month >= 5 && month <= 8) {
      return {
        id: `seasonal-${Date.now()}`,
        type: "general",
        priority: "medium",
        title: "Dry season management",
        description: "Focus on water conservation and drought-resistant practices.",
        action: "Implement water-saving techniques, mulching, and consider drought-resistant varieties",
        reasoning: "Dry season requires careful water management to maintain crop health",
        timing: {
          recommended: new Date(),
          deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
        conditions: {
          weather: "Dry season",
          crop: "All crops",
          season,
        },
      }
    }

    return null
  }

  getSoilWaterRetention(soilType) {
    const retention = {
      clay: 15,
      loam: 12,
      sandy: 6,
      silt: 10,
      peat: 20,
      chalk: 8,
    }
    return retention[soilType] || 10
  }

  calculateEvapotranspiration(temperature, humidity) {
    // Simplified Penman-Monteith equation approximation
    const baseET = 0.0023 * (temperature + 17.8) * Math.sqrt(Math.abs(temperature - humidity)) * 2.45
    return Math.max(0, baseET)
  }

  getCurrentSeason() {
    const month = new Date().getMonth()
    // East African seasons
    if (month >= 2 && month <= 5) return "long_rains"
    if (month >= 9 && month <= 11) return "short_rains"
    return "dry"
  }
}

export const aiRecommendationService = new AIRecommendationService()
