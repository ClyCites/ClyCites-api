import { generateText } from "ai"
import { openai } from "@ai-sdk/openai"
import DailyTask from "../models/dailyTaskModel.js"
import WeatherAlert from "../models/weatherAlertModel.js"
import Farm from "../models/farmModel.js"
import Crop from "../models/cropModel.js"
import Livestock from "../models/livestockModel.js"
import { weatherService } from "./weatherService.js"
import logger from "../utils/logger.js"
import { aiServiceValidator } from "./aiServiceValidator.js"

class DailyAssistantService {
  constructor() {
    if (aiServiceValidator.isAIEnabled()) {
      this.model = openai("gpt-4o")
    } else {
      this.model = null
      logger.warn("⚠️  Daily AI assistant disabled - OpenAI API key not configured")
    }
  }

  /**
   * Generate daily summary and tasks for a farm
   * @param {string} farmId - Farm ID
   * @param {string} userId - User ID
   * @param {Date} date - Target date (default: today)
   * @returns {Promise<Object>} Daily summary with tasks and recommendations
   */
  async generateDailySummary(farmId, userId, date = new Date()) {
    try {
      const farm = await Farm.findById(farmId).populate("owner")
      if (!farm) {
        throw new Error("Farm not found")
      }

      // Get current weather and forecast
      const [currentWeather, forecast] = await Promise.all([
        weatherService.getCurrentWeather(farm.location.latitude, farm.location.longitude, [
          "temperature_2m",
          "relative_humidity_2m",
          "precipitation",
          "wind_speed_10m",
          "soil_moisture_0_1cm",
          "weather_code",
        ]),
        weatherService.getForecast(farm.location.latitude, farm.location.longitude, {
          dailyVariables: ["temperature_2m_max", "temperature_2m_min", "precipitation_sum", "wind_speed_10m_max"],
          days: 3,
        }),
      ])

      // Get farm data
      const [crops, livestock, existingTasks, activeAlerts] = await Promise.all([
        Crop.find({ farm: farmId, status: { $in: ["planted", "growing"] } }),
        Livestock.find({ farm: farmId, isActive: true }),
        DailyTask.find({
          farm: farmId,
          taskDate: {
            $gte: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
            $lt: new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1),
          },
        }),
        WeatherAlert.find({
          farm: farmId,
          isActive: true,
          validUntil: { $gte: new Date() },
        }),
      ])

      // Generate weather summary
      const weatherSummary = await this.generateWeatherSummary(currentWeather, forecast)

      // Generate daily tasks
      const dailyTasks = await this.generateDailyTasks(farm, crops, livestock, currentWeather, forecast, userId, date)

      // Generate weather alerts if needed
      const newAlerts = await this.generateWeatherAlerts(farm, crops, livestock, currentWeather, forecast, userId)

      // Generate priority recommendations
      const priorityActions = await this.generatePriorityActions(
        farm,
        crops,
        livestock,
        currentWeather,
        forecast,
        existingTasks,
        userId,
      )

      // Create daily summary
      const dailySummary = {
        date: date,
        farm: {
          id: farm._id,
          name: farm.name,
          location: farm.location,
        },
        weather: {
          current: currentWeather.data,
          forecast: forecast.daily.slice(0, 3),
          summary: weatherSummary,
          alerts: [...activeAlerts, ...newAlerts],
        },
        tasks: {
          existing: existingTasks,
          generated: dailyTasks,
          total: existingTasks.length + dailyTasks.length,
          byPriority: this.categorizeTasks([...existingTasks, ...dailyTasks]),
        },
        recommendations: priorityActions,
        farmStatus: {
          activeCrops: crops.length,
          activeLivestock: livestock.length,
          totalAnimals: livestock.reduce((sum, l) => sum + l.totalAnimals, 0),
        },
        insights: await this.generateDailyInsights(farm, crops, livestock, currentWeather, forecast),
      }

      return dailySummary
    } catch (error) {
      logger.error("Error generating daily summary:", error)
      throw new Error(`Failed to generate daily summary: ${error.message}`)
    }
  }

  /**
   * Generate weather summary for the day
   */
  async generateWeatherSummary(currentWeather, forecast) {
    try {
      // If AI is not available, return basic summary
      if (!aiServiceValidator.isAIEnabled()) {
        return this.generateBasicWeatherSummary(currentWeather, forecast)
      }

      const prompt = `
        Create a brief, farmer-friendly weather summary for today and the next 2 days:
        
        Current Weather:
        - Temperature: ${currentWeather.data.temperature_2m}°C
        - Humidity: ${currentWeather.data.relative_humidity_2m}%
        - Precipitation: ${currentWeather.data.precipitation}mm
        - Wind Speed: ${currentWeather.data.wind_speed_10m} km/h
        - Soil Moisture: ${currentWeather.data.soil_moisture_0_1cm}%
        
        3-Day Forecast:
        ${forecast.daily
          .slice(0, 3)
          .map(
            (day, i) =>
              `Day ${i + 1}: ${day.data.temperature_2m_min}-${day.data.temperature_2m_max}°C, Rain: ${day.data.precipitation_sum}mm`,
          )
          .join("\n")}
        
        Provide a 2-3 sentence summary focusing on:
        1. Today's conditions for farming activities
        2. Any weather concerns or opportunities
        3. Brief outlook for the next 2 days
        
        Keep it simple and actionable for farmers.
      `

      const { text } = await generateText({
        model: this.model,
        prompt,
        maxTokens: 200,
      })

      return text.trim()
    } catch (error) {
      logger.error("Error generating weather summary:", error)
      return this.generateBasicWeatherSummary(currentWeather, forecast)
    }
  }

  /**
   * Generate basic weather summary without AI
   */
  generateBasicWeatherSummary(currentWeather, forecast) {
    try {
      const temp = currentWeather.data.temperature_2m
      const precipitation = currentWeather.data.precipitation
      const humidity = currentWeather.data.relative_humidity_2m

      let summary = `Current temperature is ${temp}°C with ${humidity}% humidity. `

      if (precipitation > 0) {
        summary += `Light rainfall detected (${precipitation}mm). `
      }

      if (temp > 30) {
        summary += "Hot conditions - ensure adequate water for crops and livestock. "
      } else if (temp < 15) {
        summary += "Cool conditions - monitor sensitive crops. "
      }

      const upcomingRain = forecast.daily.slice(0, 3).reduce((sum, day) => sum + (day.data.precipitation_sum || 0), 0)
      if (upcomingRain > 10) {
        summary += `Rain expected in the next 3 days (${upcomingRain}mm total).`
      } else {
        summary += "Dry conditions expected for the next few days."
      }

      return summary
    } catch (error) {
      logger.error("Error generating basic weather summary:", error)
      return "Weather data available. Check current conditions for planning your farm activities."
    }
  }

  /**
   * Generate daily tasks based on farm conditions
   */
  async generateDailyTasks(farm, crops, livestock, currentWeather, forecast, userId, date) {
    const tasks = []

    try {
      // Generate crop-related tasks
      for (const crop of crops) {
        const cropTasks = await this.generateCropTasks(farm, crop, currentWeather, forecast, userId, date)
        tasks.push(...cropTasks)
      }

      // Generate livestock-related tasks
      for (const animal of livestock) {
        const livestockTasks = await this.generateLivestockTasks(farm, animal, currentWeather, forecast, userId, date)
        tasks.push(...livestockTasks)
      }

      // Generate general farm tasks
      const generalTasks = await this.generateGeneralFarmTasks(farm, currentWeather, forecast, userId, date)
      tasks.push(...generalTasks)

      // Save generated tasks to database
      const savedTasks = []
      for (const task of tasks) {
        try {
          const savedTask = await DailyTask.create(task)
          savedTasks.push(savedTask)
        } catch (error) {
          logger.error("Error saving daily task:", error)
        }
      }

      return savedTasks
    } catch (error) {
      logger.error("Error generating daily tasks:", error)
      return []
    }
  }

  /**
   * Generate crop-specific tasks
   */
  async generateCropTasks(farm, crop, currentWeather, forecast, userId, date) {
    const tasks = []

    try {
      const soilMoisture = currentWeather.data.soil_moisture_0_1cm || 50
      const temperature = currentWeather.data.temperature_2m
      const precipitation = currentWeather.data.precipitation
      const upcomingRain = forecast.daily.slice(0, 2).reduce((sum, day) => sum + (day.data.precipitation_sum || 0), 0)

      // Irrigation tasks
      if (soilMoisture < 40 && upcomingRain < 5) {
        tasks.push({
          farm: farm._id,
          user: userId,
          crop: crop._id,
          taskDate: date,
          category: "irrigation",
          title: `Water ${crop.name} - Low Soil Moisture`,
          description: `Soil moisture is at ${soilMoisture}%. Water the ${crop.name} crop to prevent stress.`,
          priority: soilMoisture < 25 ? "high" : "medium",
          estimatedDuration: { value: 30, unit: "minutes" },
          weatherDependent: true,
          weatherConditions: {
            avoidConditions: ["heavy_rain"],
          },
          aiGenerated: true,
          instructions: [
            {
              step: 1,
              description: "Check soil moisture by hand or sensor",
              duration: 5,
            },
            {
              step: 2,
              description: `Apply water using ${farm.irrigationSystem || "available irrigation method"}`,
              duration: 20,
            },
            {
              step: 3,
              description: "Monitor water penetration and avoid overwatering",
              duration: 5,
            },
          ],
        })
      }

      // Pest monitoring tasks
      if (temperature > 25 && currentWeather.data.relative_humidity_2m > 70) {
        tasks.push({
          farm: farm._id,
          user: userId,
          crop: crop._id,
          taskDate: date,
          category: "pest_control",
          title: `Monitor ${crop.name} for Pests`,
          description: `High temperature (${temperature}°C) and humidity favor pest development. Check for signs of pest infestation.`,
          priority: "medium",
          estimatedDuration: { value: 15, unit: "minutes" },
          aiGenerated: true,
          instructions: [
            {
              step: 1,
              description: "Inspect leaves, stems, and fruits for pest damage",
              duration: 10,
            },
            {
              step: 2,
              description: "Look for eggs, larvae, or adult pests",
              duration: 5,
            },
          ],
        })
      }

      // Harvest timing tasks
      if (crop.daysToHarvest && crop.daysToHarvest <= 3 && crop.daysToHarvest > 0) {
        tasks.push({
          farm: farm._id,
          user: userId,
          crop: crop._id,
          taskDate: date,
          category: "harvesting",
          title: `Prepare for ${crop.name} Harvest`,
          description: `${crop.name} will be ready for harvest in ${crop.daysToHarvest} days. Prepare equipment and check market prices.`,
          priority: "high",
          estimatedDuration: { value: 45, unit: "minutes" },
          aiGenerated: true,
          instructions: [
            {
              step: 1,
              description: "Check crop maturity indicators",
              duration: 15,
            },
            {
              step: 2,
              description: "Prepare harvesting tools and containers",
              duration: 20,
            },
            {
              step: 3,
              description: "Contact buyers or check market prices",
              duration: 10,
            },
          ],
        })
      }
    } catch (error) {
      logger.error("Error generating crop tasks:", error)
    }

    return tasks
  }

  /**
   * Generate livestock-specific tasks
   */
  async generateLivestockTasks(farm, livestock, currentWeather, forecast, userId, date) {
    const tasks = []

    try {
      const temperature = currentWeather.data.temperature_2m
      const precipitation = currentWeather.data.precipitation

      // Feeding tasks
      tasks.push({
        farm: farm._id,
        user: userId,
        livestock: livestock._id,
        taskDate: date,
        category: "feeding",
        title: `Feed ${livestock.herdName} (${livestock.animalType})`,
        description: `Provide daily feed for ${livestock.totalAnimals} ${livestock.animalType}. Check feed quality and water availability.`,
        priority: "high",
        estimatedDuration: { value: 30, unit: "minutes" },
        aiGenerated: true,
        instructions: [
          {
            step: 1,
            description: "Check feed quality and quantity",
            duration: 5,
          },
          {
            step: 2,
            description: `Distribute feed according to feeding schedule`,
            duration: 20,
          },
          {
            step: 3,
            description: "Ensure clean water is available",
            duration: 5,
          },
        ],
      })

      // Health monitoring
      tasks.push({
        farm: farm._id,
        user: userId,
        livestock: livestock._id,
        taskDate: date,
        category: "health_check",
        title: `Health Check - ${livestock.herdName}`,
        description: `Daily health monitoring for ${livestock.totalAnimals} ${livestock.animalType}. Look for signs of illness or distress.`,
        priority: "medium",
        estimatedDuration: { value: 20, unit: "minutes" },
        aiGenerated: true,
        instructions: [
          {
            step: 1,
            description: "Observe animals for normal behavior and appetite",
            duration: 10,
          },
          {
            step: 2,
            description: "Check for signs of illness (lethargy, discharge, limping)",
            duration: 10,
          },
        ],
      })

      // Weather-specific tasks
      if (temperature > 30) {
        tasks.push({
          farm: farm._id,
          user: userId,
          livestock: livestock._id,
          taskDate: date,
          category: "monitoring",
          title: `Heat Stress Prevention - ${livestock.herdName}`,
          description: `High temperature (${temperature}°C) detected. Provide shade and extra water to prevent heat stress.`,
          priority: "high",
          estimatedDuration: { value: 25, unit: "minutes" },
          weatherDependent: true,
          aiGenerated: true,
          instructions: [
            {
              step: 1,
              description: "Ensure adequate shade is available",
              duration: 10,
            },
            {
              step: 2,
              description: "Increase water availability and check consumption",
              duration: 15,
            },
          ],
        })
      }

      if (precipitation > 10) {
        tasks.push({
          farm: farm._id,
          user: userId,
          livestock: livestock._id,
          taskDate: date,
          category: "maintenance",
          title: `Shelter Check - ${livestock.herdName}`,
          description: `Heavy rain detected (${precipitation}mm). Ensure animals have adequate shelter and dry bedding.`,
          priority: "medium",
          estimatedDuration: { value: 20, unit: "minutes" },
          weatherDependent: true,
          aiGenerated: true,
          instructions: [
            {
              step: 1,
              description: "Check shelter integrity and drainage",
              duration: 10,
            },
            {
              step: 2,
              description: "Replace wet bedding if necessary",
              duration: 10,
            },
          ],
        })
      }

      // Vaccination reminders
      const upcomingVaccinations = livestock.upcomingVaccinations
      if (upcomingVaccinations && upcomingVaccinations.length > 0) {
        for (const vaccination of upcomingVaccinations) {
          tasks.push({
            farm: farm._id,
            user: userId,
            livestock: livestock._id,
            taskDate: vaccination.nextDue,
            category: "vaccination",
            title: `Vaccination Due - ${vaccination.vaccine}`,
            description: `${vaccination.vaccine} vaccination is due for ${livestock.herdName}. Contact veterinarian to schedule.`,
            priority: "high",
            estimatedDuration: { value: 60, unit: "minutes" },
            aiGenerated: true,
            instructions: [
              {
                step: 1,
                description: "Contact veterinarian to schedule vaccination",
                duration: 10,
              },
              {
                step: 2,
                description: "Prepare animals and vaccination area",
                duration: 20,
              },
              {
                step: 3,
                description: "Assist with vaccination process",
                duration: 30,
              },
            ],
          })
        }
      }
    } catch (error) {
      logger.error("Error generating livestock tasks:", error)
    }

    return tasks
  }

  /**
   * Generate general farm tasks
   */
  async generateGeneralFarmTasks(farm, currentWeather, forecast, userId, date) {
    const tasks = []

    try {
      const windSpeed = currentWeather.data.wind_speed_10m
      const precipitation = currentWeather.data.precipitation

      // Equipment maintenance
      if (date.getDay() === 1) {
        // Monday
        tasks.push({
          farm: farm._id,
          user: userId,
          taskDate: date,
          category: "maintenance",
          title: "Weekly Equipment Check",
          description: "Inspect and maintain farm equipment, tools, and infrastructure.",
          priority: "medium",
          estimatedDuration: { value: 45, unit: "minutes" },
          aiGenerated: true,
          instructions: [
            {
              step: 1,
              description: "Check irrigation system for leaks or blockages",
              duration: 15,
            },
            {
              step: 2,
              description: "Inspect tools and equipment for damage",
              duration: 20,
            },
            {
              step: 3,
              description: "Clean and organize storage areas",
              duration: 10,
            },
          ],
        })
      }

      // Weather monitoring
      tasks.push({
        farm: farm._id,
        user: userId,
        taskDate: date,
        category: "monitoring",
        title: "Daily Weather and Farm Monitoring",
        description: "Check weather conditions and monitor overall farm status.",
        priority: "low",
        estimatedDuration: { value: 15, unit: "minutes" },
        aiGenerated: true,
        instructions: [
          {
            step: 1,
            description: "Review weather forecast for the day",
            duration: 5,
          },
          {
            step: 2,
            description: "Walk around farm to check general conditions",
            duration: 10,
          },
        ],
      })

      // Strong wind precautions
      if (windSpeed > 25) {
        tasks.push({
          farm: farm._id,
          user: userId,
          taskDate: date,
          category: "weather_response",
          title: "Strong Wind Precautions",
          description: `Strong winds detected (${windSpeed} km/h). Secure loose items and check for damage.`,
          priority: "high",
          estimatedDuration: { value: 30, unit: "minutes" },
          weatherDependent: true,
          aiGenerated: true,
          instructions: [
            {
              step: 1,
              description: "Secure loose equipment and materials",
              duration: 15,
            },
            {
              step: 2,
              description: "Check structures for wind damage",
              duration: 15,
            },
          ],
        })
      }
    } catch (error) {
      logger.error("Error generating general farm tasks:", error)
    }

    return tasks
  }

  /**
   * Generate weather alerts
   */
  async generateWeatherAlerts(farm, crops, livestock, currentWeather, forecast, userId) {
    const alerts = []

    try {
      const temperature = currentWeather.data.temperature_2m
      const precipitation = currentWeather.data.precipitation
      const humidity = currentWeather.data.relative_humidity_2m
      const soilMoisture = currentWeather.data.soil_moisture_0_1cm

      // Extreme temperature alerts
      if (temperature > 35) {
        alerts.push({
          farm: farm._id,
          user: userId,
          alertType: "extreme_heat",
          severity: "warning",
          title: "Extreme Heat Warning",
          message: `Temperature has reached ${temperature}°C. Take immediate action to protect crops and livestock from heat stress.`,
          weatherData: { current: currentWeather.data },
          affectedCrops: crops.map((c) => c._id),
          affectedLivestock: livestock.map((l) => l._id),
          recommendedActions: [
            {
              action: "Increase irrigation frequency for crops",
              priority: "high",
              timeframe: "immediate",
              estimatedCost: 50,
            },
            {
              action: "Provide additional shade and water for livestock",
              priority: "critical",
              timeframe: "immediate",
              estimatedCost: 30,
            },
          ],
          validFrom: new Date(),
          validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        })
      }

      // Heavy rain alerts
      if (precipitation > 20) {
        alerts.push({
          farm: farm._id,
          user: userId,
          alertType: "heavy_rain",
          severity: "advisory",
          title: "Heavy Rainfall Alert",
          message: `Heavy rainfall detected (${precipitation}mm). Ensure proper drainage and protect sensitive crops.`,
          weatherData: { current: currentWeather.data },
          affectedCrops: crops.map((c) => c._id),
          affectedLivestock: livestock.map((l) => l._id),
          recommendedActions: [
            {
              action: "Check and clear drainage systems",
              priority: "high",
              timeframe: "immediate",
              estimatedCost: 20,
            },
            {
              action: "Provide shelter for livestock",
              priority: "medium",
              timeframe: "within 2 hours",
              estimatedCost: 0,
            },
          ],
          validFrom: new Date(),
          validUntil: new Date(Date.now() + 12 * 60 * 60 * 1000), // 12 hours
        })
      }

      // Drought conditions
      if (soilMoisture < 20) {
        alerts.push({
          farm: farm._id,
          user: userId,
          alertType: "drought",
          severity: "watch",
          title: "Low Soil Moisture Alert",
          message: `Soil moisture is critically low at ${soilMoisture}%. Immediate irrigation required to prevent crop failure.`,
          weatherData: { current: currentWeather.data },
          affectedCrops: crops.map((c) => c._id),
          recommendedActions: [
            {
              action: "Implement emergency irrigation",
              priority: "critical",
              timeframe: "immediate",
              estimatedCost: 100,
              potentialLoss: 1000,
            },
            {
              action: "Apply mulch to conserve soil moisture",
              priority: "high",
              timeframe: "within 24 hours",
              estimatedCost: 50,
            },
          ],
          validFrom: new Date(),
          validUntil: new Date(Date.now() + 48 * 60 * 60 * 1000), // 48 hours
        })
      }

      // Save alerts to database
      const savedAlerts = []
      for (const alert of alerts) {
        try {
          const savedAlert = await WeatherAlert.create(alert)
          savedAlerts.push(savedAlert)
        } catch (error) {
          logger.error("Error saving weather alert:", error)
        }
      }

      return savedAlerts
    } catch (error) {
      logger.error("Error generating weather alerts:", error)
      return []
    }
  }

  /**
   * Generate priority actions for the day
   */
  async generatePriorityActions(farm, crops, livestock, currentWeather, forecast, existingTasks, userId) {
    try {
      const prompt = `
        As an agricultural AI assistant, analyze the farm situation and provide 3-5 priority actions for today:
        
        Farm: ${farm.name} (${farm.farmType})
        Location: ${farm.location.address || "Coordinates provided"}
        
        Current Weather:
        - Temperature: ${currentWeather.data.temperature_2m}°C
        - Humidity: ${currentWeather.data.relative_humidity_2m}%
        - Precipitation: ${currentWeather.data.precipitation}mm
        - Soil Moisture: ${currentWeather.data.soil_moisture_0_1cm}%
        
        Active Crops: ${crops.map((c) => `${c.name} (${c.growthStage})`).join(", ")}
        Livestock: ${livestock.map((l) => `${l.totalAnimals} ${l.animalType}`).join(", ")}
        
        Existing Tasks Today: ${existingTasks.length}
        
        Provide 3-5 specific, actionable priority recommendations for today. Focus on:
        1. Weather-related urgent actions
        2. Time-sensitive farm activities
        3. Preventive measures
        4. Optimization opportunities
        
        Format each as:
        PRIORITY: [1-5]
        ACTION: [Brief action title]
        REASON: [Why this is important today]
        TIMEFRAME: [When to do it]
      `

      const { text } = await generateText({
        model: this.model,
        prompt,
        maxTokens: 800,
      })

      return this.parsePriorityActions(text)
    } catch (error) {
      logger.error("Error generating priority actions:", error)
      return []
    }
  }

  /**
   * Generate daily insights
   */
  async generateDailyInsights(farm, crops, livestock, currentWeather, forecast) {
    try {
      const insights = []

      // Weather insights
      const temp = currentWeather.data.temperature_2m
      const humidity = currentWeather.data.relative_humidity_2m
      const soilMoisture = currentWeather.data.soil_moisture_0_1cm

      if (temp > 30 && humidity > 80) {
        insights.push({
          type: "weather",
          message: "High temperature and humidity create ideal conditions for fungal diseases. Monitor crops closely.",
          priority: "medium",
        })
      }

      if (soilMoisture > 80) {
        insights.push({
          type: "soil",
          message: "Soil moisture is very high. Avoid heavy machinery to prevent soil compaction.",
          priority: "low",
        })
      }

      // Crop insights
      const matureCrops = crops.filter((c) => c.daysToHarvest && c.daysToHarvest <= 7)
      if (matureCrops.length > 0) {
        insights.push({
          type: "harvest",
          message: `${matureCrops.length} crop(s) approaching harvest. Plan labor and storage accordingly.`,
          priority: "high",
        })
      }

      // Livestock insights
      const totalAnimals = livestock.reduce((sum, l) => sum + l.totalAnimals, 0)
      if (totalAnimals > 0 && temp > 32) {
        insights.push({
          type: "livestock",
          message: "High temperatures may stress livestock. Ensure adequate water and shade.",
          priority: "high",
        })
      }

      return insights
    } catch (error) {
      logger.error("Error generating daily insights:", error)
      return []
    }
  }

  /**
   * Categorize tasks by priority
   */
  categorizeTasks(tasks) {
    return {
      critical: tasks.filter((t) => t.priority === "critical").length,
      high: tasks.filter((t) => t.priority === "high").length,
      medium: tasks.filter((t) => t.priority === "medium").length,
      low: tasks.filter((t) => t.priority === "low").length,
    }
  }

  /**
   * Parse priority actions from AI response
   */
  parsePriorityActions(text) {
    const actions = []
    const sections = text.split("PRIORITY:").filter((section) => section.trim().length > 0)

    for (const section of sections) {
      const lines = section.split("\n").map((line) => line.trim())

      const priorityMatch = lines[0]?.match(/(\d+)/)
      const priority = priorityMatch ? Number.parseInt(priorityMatch[1]) : 3

      let action = ""
      let reason = ""
      let timeframe = ""

      for (const line of lines) {
        if (line.startsWith("ACTION:")) {
          action = line.replace("ACTION:", "").trim()
        } else if (line.startsWith("REASON:")) {
          reason = line.replace("REASON:", "").trim()
        } else if (line.startsWith("TIMEFRAME:")) {
          timeframe = line.replace("TIMEFRAME:", "").trim()
        }
      }

      if (action && reason) {
        actions.push({
          priority,
          action: action.substring(0, 200),
          reason: reason.substring(0, 300),
          timeframe: timeframe || "today",
        })
      }
    }

    return actions.sort((a, b) => a.priority - b.priority).slice(0, 5)
  }

  /**
   * Get tasks for a specific date
   */
  async getTasksForDate(farmId, userId, date) {
    try {
      const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate())
      const endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1)

      const tasks = await DailyTask.find({
        farm: farmId,
        user: userId,
        taskDate: {
          $gte: startOfDay,
          $lt: endOfDay,
        },
      })
        .populate("crop", "name category growthStage")
        .populate("livestock", "herdName animalType totalAnimals")
        .sort({ priority: -1, urgencyScore: -1 })

      return tasks
    } catch (error) {
      logger.error("Error fetching tasks for date:", error)
      throw new Error(`Failed to fetch tasks: ${error.message}`)
    }
  }

  /**
   * Update task status
   */
  async updateTaskStatus(taskId, userId, status, completionData = {}) {
    try {
      const task = await DailyTask.findOne({
        _id: taskId,
        user: userId,
      })

      if (!task) {
        throw new Error("Task not found")
      }

      task.status = status

      if (status === "completed") {
        task.completion = {
          completedAt: new Date(),
          completedBy: userId,
          ...completionData,
        }
      }

      await task.save()
      return task
    } catch (error) {
      logger.error("Error updating task status:", error)
      throw new Error(`Failed to update task: ${error.message}`)
    }
  }
}

export const dailyAssistantService = new DailyAssistantService()
