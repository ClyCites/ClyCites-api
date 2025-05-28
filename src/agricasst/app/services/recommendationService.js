import Crop from "../models/Crop.js"
import Weather from "../models/Weather.js"
import { logger } from "../utils/logger.js"

class RecommendationService {
  async getCropRecommendations(userId, location, options = {}) {
    try {
      const weather = await this.getWeatherData(userId, location)
      if (!weather) {
        throw new Error("Weather data not available for this location")
      }

      const crops = await Crop.find({ isActive: true })
      const recommendations = []

      for (const crop of crops) {
        const suitability = this.calculateCropSuitability(crop, weather, options)
        if (suitability.score > 0.5) {
          recommendations.push({
            crop: {
              id: crop._id,
              name: crop.name,
              scientificName: crop.scientificName,
              category: crop.category,
              difficulty: crop.difficulty,
            },
            suitabilityScore: Math.round(suitability.score * 100) / 100,
            reasons: suitability.reasons,
            warnings: suitability.warnings,
            plantingAdvice: this.generatePlantingAdvice(crop, weather),
            expectedYield: this.estimateYield(crop, weather),
            marketPotential: crop.marketInfo,
            riskFactors: this.assessRiskFactors(crop, weather),
          })
        }
      }

      return recommendations.sort((a, b) => b.suitabilityScore - a.suitabilityScore)
    } catch (error) {
      logger.error("Error generating crop recommendations:", error)
      throw error
    }
  }

  async getWeatherData(userId, location) {
    return await Weather.findOne({
      userId,
      "location.latitude": {
        $gte: location.latitude - 0.1,
        $lte: location.latitude + 0.1,
      },
      "location.longitude": {
        $gte: location.longitude - 0.1,
        $lte: location.longitude + 0.1,
      },
    }).sort({ "dataQuality.lastUpdated": -1 })
  }

  calculateCropSuitability(crop, weather, options) {
    let score = 1.0
    const reasons = []
    const warnings = []

    // Temperature suitability
    const tempSuitability = this.assessTemperatureSuitability(crop, weather)
    score *= tempSuitability.multiplier
    reasons.push(...tempSuitability.reasons)
    warnings.push(...tempSuitability.warnings)

    // Humidity suitability
    const humiditySuitability = this.assessHumiditySuitability(crop, weather)
    score *= humiditySuitability.multiplier
    reasons.push(...humiditySuitability.reasons)
    warnings.push(...humiditySuitability.warnings)

    // Rainfall assessment
    const rainfallSuitability = this.assessRainfallSuitability(crop, weather)
    score *= rainfallSuitability.multiplier
    reasons.push(...rainfallSuitability.reasons)
    warnings.push(...rainfallSuitability.warnings)

    // Seasonal timing
    if (options.season) {
      const seasonalSuitability = this.checkSeasonalTiming(crop, options.season)
      score *= seasonalSuitability.multiplier
      if (seasonalSuitability.message) {
        if (seasonalSuitability.multiplier > 0.8) {
          reasons.push(seasonalSuitability.message)
        } else {
          warnings.push(seasonalSuitability.message)
        }
      }
    }

    // Market demand consideration
    if (crop.marketInfo?.demandLevel === "high") {
      score *= 1.1
      reasons.push("High market demand for this crop")
    }

    return { score, reasons, warnings }
  }

  assessTemperatureSuitability(crop, weather) {
    const currentTemp = weather.current.temperature
    const tempReq = crop.climaticRequirements.temperature
    const reasons = []
    const warnings = []
    let multiplier = 1.0

    if (currentTemp >= tempReq.optimal.min && currentTemp <= tempReq.optimal.max) {
      reasons.push("Optimal temperature conditions")
      multiplier = 1.0
    } else if (currentTemp >= tempReq.tolerance.min && currentTemp <= tempReq.tolerance.max) {
      warnings.push("Temperature is within tolerance but not optimal")
      multiplier = 0.8
    } else {
      warnings.push("Temperature conditions are challenging for this crop")
      multiplier = 0.3
    }

    return { multiplier, reasons, warnings }
  }

  assessHumiditySuitability(crop, weather) {
    const currentHumidity = weather.current.humidity
    const humidityReq = crop.climaticRequirements.humidity
    const reasons = []
    const warnings = []
    let multiplier = 1.0

    if (currentHumidity >= humidityReq.min && currentHumidity <= humidityReq.max) {
      reasons.push("Good humidity levels")
    } else {
      warnings.push("Humidity levels may affect crop performance")
      multiplier = 0.7
    }

    return { multiplier, reasons, warnings }
  }

  assessRainfallSuitability(crop, weather) {
    const forecastRainfall = weather.forecast.reduce((sum, day) => sum + day.precipitation.amount, 0)
    const reasons = []
    const warnings = []
    let multiplier = 1.0

    if (forecastRainfall > 10) {
      reasons.push("Adequate rainfall expected")
    } else if (forecastRainfall > 5) {
      warnings.push("Moderate rainfall - monitor soil moisture")
      multiplier = 0.8
    } else {
      warnings.push("Low rainfall - irrigation will be needed")
      multiplier = 0.6
    }

    return { multiplier, reasons, warnings }
  }

  checkSeasonalTiming(crop, season) {
    const currentMonth = new Date().getMonth() + 1
    const plantingWindows = crop.plantingCalendar

    for (const window of plantingWindows) {
      const startMonth = window.plantingWindow.start.month
      const endMonth = window.plantingWindow.end.month

      if (this.isInPlantingWindow(currentMonth, startMonth, endMonth)) {
        return {
          multiplier: 1.0,
          message: "Perfect planting time for this crop",
        }
      }
    }

    return {
      multiplier: 0.5,
      message: "Not the ideal planting season for this crop",
    }
  }

  isInPlantingWindow(currentMonth, startMonth, endMonth) {
    if (startMonth <= endMonth) {
      return currentMonth >= startMonth && currentMonth <= endMonth
    } else {
      return currentMonth >= startMonth || currentMonth <= endMonth
    }
  }

  generatePlantingAdvice(crop, weather) {
    const advice = []

    // Soil preparation
    if (weather.agriculturalMetrics.soilTemperature.surface < 15) {
      advice.push("Wait for soil to warm up before planting")
    }

    // Irrigation advice
    const upcomingRain = weather.forecast.slice(0, 3).some((day) => day.precipitation.amount > 5)
    if (!upcomingRain) {
      advice.push("Ensure adequate irrigation as low rainfall is expected")
    }

    // Pest management
    if (weather.current.humidity > 80) {
      advice.push("High humidity may increase fungal disease risk - monitor closely")
    }

    // Heat stress prevention
    if (weather.agriculturalMetrics.heatStress.level === "high") {
      advice.push("Consider shade nets or mulching to protect from heat stress")
    }

    // Wind protection
    if (weather.current.windSpeed > 15) {
      advice.push("Provide wind protection for young plants")
    }

    return advice
  }

  estimateYield(crop, weather) {
    let baseYield = 100 // percentage of optimal yield

    // Temperature impact
    const tempOptimal = crop.climaticRequirements.temperature.optimal
    const currentTemp = weather.current.temperature

    if (currentTemp < tempOptimal.min || currentTemp > tempOptimal.max) {
      baseYield *= 0.8
    }

    // Rainfall impact
    const weeklyRainfall = weather.forecast.reduce((sum, day) => sum + day.precipitation.amount, 0)
    if (weeklyRainfall < 10) {
      baseYield *= 0.9
    }

    // Heat stress impact
    if (weather.agriculturalMetrics.heatStress.level === "high") {
      baseYield *= 0.7
    } else if (weather.agriculturalMetrics.heatStress.level === "extreme") {
      baseYield *= 0.5
    }

    // Humidity impact
    if (weather.current.humidity < 30 || weather.current.humidity > 90) {
      baseYield *= 0.85
    }

    return {
      estimated: Math.round(baseYield),
      unit: "percentage of optimal",
      factors: "Based on current weather conditions",
      confidence: baseYield > 80 ? "high" : baseYield > 60 ? "medium" : "low",
    }
  }

  assessRiskFactors(crop, weather) {
    const risks = []

    // Temperature risks
    if (weather.current.temperature > crop.climaticRequirements.temperature.tolerance.max) {
      risks.push({
        type: "temperature",
        level: "high",
        description: "Temperature exceeds crop tolerance",
        mitigation: "Provide shade, increase irrigation",
      })
    }

    // Pest risks based on weather
    if (weather.current.humidity > 80 && weather.current.temperature > 25) {
      risks.push({
        type: "pest",
        level: "moderate",
        description: "High humidity and temperature favor pest development",
        mitigation: "Monitor for pests, consider preventive treatments",
      })
    }

    // Disease risks
    if (weather.current.humidity > 85) {
      risks.push({
        type: "disease",
        level: "moderate",
        description: "High humidity increases fungal disease risk",
        mitigation: "Improve air circulation, avoid overhead watering",
      })
    }

    // Drought risk
    const upcomingRain = weather.forecast.reduce((sum, day) => sum + day.precipitation.amount, 0)
    if (upcomingRain < 5) {
      risks.push({
        type: "drought",
        level: "moderate",
        description: "Low rainfall expected in coming days",
        mitigation: "Plan irrigation schedule, mulch to retain moisture",
      })
    }

    return risks
  }

  async getIrrigationRecommendations(userId, cropType, location, options = {}) {
    try {
      const weather = await this.getWeatherData(userId, location)
      if (!weather) {
        throw new Error("Weather data not available")
      }

      const crop = await Crop.findOne({
        $or: [{ name: new RegExp(cropType, "i") }, { commonNames: new RegExp(cropType, "i") }],
      })

      const et = weather.agriculturalMetrics.evapotranspiration.crop
      const rainfall = weather.forecast.slice(0, 3).reduce((sum, day) => sum + day.precipitation.amount, 0)

      const irrigationNeed = Math.max(0, et - rainfall)

      return {
        irrigationRequired: irrigationNeed > 5,
        amount: Math.round(irrigationNeed * 10) / 10,
        frequency: this.calculateIrrigationFrequency(irrigationNeed, weather.current.temperature),
        timing: this.getOptimalIrrigationTiming(weather),
        method: this.recommendIrrigationMethod(cropType, weather, options),
        nextIrrigation: this.calculateNextIrrigationDate(irrigationNeed),
        efficiency: this.calculateIrrigationEfficiency(weather),
        waterRequirement: this.calculateWaterRequirement(crop, weather, options.farmSize),
      }
    } catch (error) {
      logger.error("Error generating irrigation recommendations:", error)
      throw error
    }
  }

  calculateIrrigationFrequency(need, temperature) {
    if (need > 15 || temperature > 35) return "Daily"
    if (need > 10 || temperature > 30) return "Every 2 days"
    if (need > 5) return "Every 3-4 days"
    return "Weekly"
  }

  getOptimalIrrigationTiming(weather) {
    const sunrise = weather.current.sunrise
    const sunset = weather.current.sunset

    return {
      primary: "Early morning (6-8 AM)",
      secondary: "Late evening (6-8 PM)",
      avoid: "Midday (11 AM - 3 PM)",
      reason: "Minimize evaporation and allow plants to absorb water efficiently",
    }
  }

  recommendIrrigationMethod(cropType, weather, options) {
    const recommendations = []

    if (weather.current.windSpeed > 15) {
      recommendations.push({
        method: "Drip irrigation",
        reason: "High winds reduce sprinkler efficiency",
        efficiency: 90,
      })
    }

    if (weather.current.humidity < 30) {
      recommendations.push({
        method: "Drip or subsurface irrigation",
        reason: "Low humidity increases evaporation",
        efficiency: 85,
      })
    }

    if (options.farmSize && options.farmSize > 10) {
      recommendations.push({
        method: "Center pivot or linear move",
        reason: "Large farm size benefits from automated systems",
        efficiency: 80,
      })
    }

    if (recommendations.length === 0) {
      recommendations.push({
        method: "Sprinkler or drip irrigation",
        reason: "Standard conditions suitable for multiple methods",
        efficiency: 75,
      })
    }

    return recommendations[0]
  }

  calculateNextIrrigationDate(need) {
    const daysUntilNext = need > 10 ? 1 : need > 5 ? 2 : 3
    const nextDate = new Date()
    nextDate.setDate(nextDate.getDate() + daysUntilNext)
    return nextDate
  }

  calculateIrrigationEfficiency(weather) {
    let efficiency = 75 // base efficiency

    if (weather.current.windSpeed > 10) efficiency -= 10
    if (weather.current.humidity < 40) efficiency -= 5
    if (weather.current.temperature > 35) efficiency -= 5

    return Math.max(50, efficiency)
  }

  calculateWaterRequirement(crop, weather, farmSize) {
    if (!crop || !farmSize) return null

    const dailyET = weather.agriculturalMetrics.evapotranspiration.crop
    const cropCoefficient = this.getCropCoefficient(crop.category)
    const dailyRequirement = dailyET * cropCoefficient

    return {
      daily: Math.round(dailyRequirement * farmSize * 10) / 10,
      weekly: Math.round(dailyRequirement * farmSize * 7 * 10) / 10,
      unit: "mm per hectare",
    }
  }

  getCropCoefficient(category) {
    const coefficients = {
      vegetable: 1.0,
      fruit: 1.2,
      cereal: 0.8,
      legume: 0.9,
      cash_crop: 1.1,
      forage: 0.7,
    }
    return coefficients[category] || 1.0
  }

  getOptimalPlantingTiming(crop, weather) {
    const currentMonth = new Date().getMonth() + 1
    const plantingWindows = crop.plantingCalendar

    const recommendations = plantingWindows.map((window) => {
      const isOptimal = this.isInPlantingWindow(
        currentMonth,
        window.plantingWindow.start.month,
        window.plantingWindow.end.month,
      )

      return {
        region: window.region,
        isOptimal,
        plantingWindow: window.plantingWindow,
        harvestWindow: window.harvestWindow,
        notes: window.notes,
      }
    })

    return {
      current: recommendations.find((r) => r.isOptimal),
      upcoming: recommendations.filter((r) => !r.isOptimal),
      weatherSuitability: this.assessCurrentWeatherForPlanting(crop, weather),
    }
  }

  assessCurrentWeatherForPlanting(crop, weather) {
    const suitability = []
    const tempReq = crop.climaticRequirements.temperature

    if (weather.current.temperature >= tempReq.optimal.min && weather.current.temperature <= tempReq.optimal.max) {
      suitability.push("Temperature is optimal for planting")
    }

    if (weather.agriculturalMetrics.soilTemperature.surface > 10) {
      suitability.push("Soil temperature is suitable")
    }

    const upcomingRain = weather.forecast.slice(0, 3).some((day) => day.precipitation.amount > 2)
    if (upcomingRain) {
      suitability.push("Rainfall expected to help with germination")
    }

    return suitability
  }

  async getFertilizerRecommendations(options) {
    const { cropType, growthStage, soilType, farmSize, organicPreference } = options

    const crop = await Crop.findOne({
      $or: [{ name: new RegExp(cropType, "i") }, { commonNames: new RegExp(cropType, "i") }],
    })

    const baseRecommendations = this.getBaseFertilizerRecommendations(growthStage, organicPreference)
    const cropSpecific = crop ? this.getCropSpecificFertilizer(crop, growthStage) : null

    return {
      cropType,
      growthStage,
      soilType: soilType || "general",
      recommendation: baseRecommendations,
      cropSpecific,
      application: this.getFertilizerApplication(farmSize),
      timing: this.getFertilizerTiming(growthStage),
      additionalTips: [
        "Always water after fertilizer application",
        "Avoid fertilizing during extreme weather",
        "Monitor plants for signs of over-fertilization",
        "Test soil pH before application",
      ],
    }
  }

  getBaseFertilizerRecommendations(growthStage, organic = false) {
    const organicOptions = {
      germination: {
        primary: "Compost or well-aged manure",
        application: "Mix into soil before planting",
        amount: "2-3 kg per square meter",
        timing: "Pre-planting soil preparation",
      },
      vegetative: {
        primary: "Fish emulsion or blood meal (high nitrogen)",
        application: "Apply every 2-3 weeks",
        amount: "1-2 tablespoons per plant",
        timing: "Early morning application",
      },
      flowering: {
        primary: "Bone meal or rock phosphate",
        application: "Apply at flower initiation",
        amount: "1 tablespoon per plant",
        timing: "Avoid during peak flowering",
      },
      fruiting: {
        primary: "Wood ash or kelp meal (high potassium)",
        application: "Apply weekly during fruit development",
        amount: "1-2 tablespoons per plant",
        timing: "Morning application with adequate water",
      },
    }

    const syntheticOptions = {
      germination: {
        primary: "Starter fertilizer (NPK 10-10-10)",
        application: "Light application at planting",
        amount: "20-30g per plant",
        timing: "At planting time",
      },
      vegetative: {
        primary: "High nitrogen fertilizer (NPK 20-10-10)",
        application: "Apply every 2-3 weeks",
        amount: "50-100g per plant",
        timing: "Early morning application",
      },
      flowering: {
        primary: "Balanced fertilizer (NPK 15-15-15)",
        application: "Apply every 2 weeks",
        amount: "30-60g per plant",
        timing: "Avoid during peak flowering",
      },
      fruiting: {
        primary: "High potassium fertilizer (NPK 10-10-20)",
        application: "Apply weekly",
        amount: "40-80g per plant",
        timing: "Morning application with adequate water",
      },
    }

    const recommendations = organic ? organicOptions : syntheticOptions
    return recommendations[growthStage.toLowerCase()] || recommendations["vegetative"]
  }

  getCropSpecificFertilizer(crop, growthStage) {
    const stage = crop.growthStages.find((s) => s.stage.toLowerCase() === growthStage.toLowerCase())
    return stage ? stage.requirements.nutrients : null
  }

  getFertilizerApplication(farmSize) {
    if (!farmSize) return "Follow package instructions for application rates"

    if (farmSize < 1) return "Hand application suitable for small plots"
    if (farmSize < 10) return "Broadcast spreader recommended"
    return "Tractor-mounted spreader for large areas"
  }

  getFertilizerTiming(growthStage) {
    const timing = {
      germination: "Apply 1-2 weeks before planting",
      vegetative: "Regular applications every 2-3 weeks",
      flowering: "Reduce frequency, focus on phosphorus",
      fruiting: "Increase potassium, reduce nitrogen",
    }

    return timing[growthStage.toLowerCase()] || "Follow crop-specific guidelines"
  }

  async getPestManagementRecommendations(userId, cropName, location, symptoms = []) {
    try {
      const crop = await Crop.findOne({
        $or: [{ name: new RegExp(cropName, "i") }, { commonNames: new RegExp(cropName, "i") }],
      })

      if (!crop) {
        throw new Error("Crop not found")
      }

      const weather = await this.getWeatherData(userId, location)
      const seasonalPests = this.getSeasonalPests(crop, weather)
      const weatherBasedRisks = this.assessPestRiskFromWeather(weather)

      return {
        crop: crop.name,
        commonPests: crop.pests,
        commonDiseases: crop.diseases,
        seasonalRisks: seasonalPests,
        weatherBasedRisks,
        preventiveMeasures: this.getPreventiveMeasures(crop),
        organicTreatments: this.getOrganicTreatments(crop),
        monitoringSchedule: this.getPestMonitoringSchedule(),
        symptoms: symptoms.length > 0 ? this.diagnosePestIssues(symptoms, crop) : null,
      }
    } catch (error) {
      logger.error("Error generating pest management recommendations:", error)
      throw error
    }
  }

  getSeasonalPests(crop, weather) {
    const currentMonth = new Date().getMonth() + 1
    const temperature = weather.current.temperature
    const humidity = weather.current.humidity

    return crop.pests.filter((pest) => {
      // Simple seasonal filtering based on temperature and humidity
      if (temperature > 25 && humidity > 70) return pest.severity !== "low"
      if (temperature < 15) return pest.name.toLowerCase().includes("aphid")
      return true
    })
  }

  assessPestRiskFromWeather(weather) {
    const risks = []

    if (weather.current.humidity > 80 && weather.current.temperature > 20) {
      risks.push({
        type: "fungal diseases",
        level: "high",
        reason: "High humidity and warm temperatures favor fungal growth",
      })
    }

    if (weather.current.temperature > 30 && weather.current.humidity < 40) {
      risks.push({
        type: "spider mites",
        level: "moderate",
        reason: "Hot, dry conditions favor spider mite reproduction",
      })
    }

    if (weather.current.windSpeed > 20) {
      risks.push({
        type: "pest dispersal",
        level: "moderate",
        reason: "Strong winds can spread flying pests to new areas",
      })
    }

    return risks
  }

  getPreventiveMeasures(crop) {
    return [
      "Regular field inspection and monitoring",
      "Maintain proper plant spacing for air circulation",
      "Remove plant debris and weeds",
      "Use resistant varieties when available",
      "Implement crop rotation practices",
      "Encourage beneficial insects with diverse plantings",
    ]
  }

  getOrganicTreatments(crop) {
    return [
      {
        pest: "Aphids",
        treatment: "Neem oil spray or insecticidal soap",
        application: "Spray in early morning or evening",
      },
      {
        pest: "Caterpillars",
        treatment: "Bacillus thuringiensis (Bt) spray",
        application: "Apply when larvae are small",
      },
      {
        pest: "Fungal diseases",
        treatment: "Baking soda solution or copper fungicide",
        application: "Preventive spraying in humid conditions",
      },
      {
        pest: "Spider mites",
        treatment: "Predatory mites or miticide soap",
        application: "Increase humidity around plants",
      },
    ]
  }

  getPestMonitoringSchedule() {
    return {
      frequency: "Weekly during growing season",
      timing: "Early morning when pests are most active",
      focus: [
        "Check undersides of leaves",
        "Look for damage patterns",
        "Monitor for beneficial insects",
        "Record weather conditions",
      ],
      tools: [
        "Hand lens or magnifying glass",
        "Yellow sticky traps",
        "Pheromone traps for specific pests",
        "Digital camera for documentation",
      ],
    }
  }

  diagnosePestIssues(symptoms, crop) {
    // Simple symptom matching - in a real system, this would be more sophisticated
    const diagnosis = []

    symptoms.forEach((symptom) => {
      const lowerSymptom = symptom.toLowerCase()

      if (lowerSymptom.includes("holes") || lowerSymptom.includes("chewed")) {
        diagnosis.push({
          likelyPest: "Caterpillars or beetles",
          confidence: "moderate",
          treatment: "Hand picking or Bt spray",
        })
      }

      if (lowerSymptom.includes("yellow") || lowerSymptom.includes("wilting")) {
        diagnosis.push({
          likelyPest: "Aphids or root problems",
          confidence: "low",
          treatment: "Check for aphids and soil moisture",
        })
      }

      if (lowerSymptom.includes("spots") || lowerSymptom.includes("mold")) {
        diagnosis.push({
          likelyPest: "Fungal disease",
          confidence: "moderate",
          treatment: "Improve air circulation, apply fungicide",
        })
      }
    })

    return diagnosis
  }
}

export default new RecommendationService()
