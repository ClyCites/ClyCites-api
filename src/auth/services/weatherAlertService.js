import WeatherAlert from "../models/weatherAlertModel.js"
import DailyTask from "../models/dailyTaskModel.js"
import { notificationService } from "./notificationService.js"
import logger from "../utils/logger.js"

class WeatherAlertService {
  constructor() {
    this.alertThresholds = {
      extreme_heat: { temperature: 35, severity: "warning" },
      heavy_rain: { precipitation: 20, severity: "advisory" },
      drought: { soilMoisture: 20, severity: "watch" },
      frost: { temperature: 2, severity: "warning" },
      strong_wind: { windSpeed: 25, severity: "advisory" },
      flood_risk: { precipitation: 50, severity: "emergency" },
    }
  }

  /**
   * Generate weather alerts for a farm
   */
  async generateWeatherAlerts(farm, crops, livestock, currentWeather, forecast, userId) {
    const alerts = []

    try {
      // Check current weather conditions
      const currentAlerts = await this.checkCurrentWeatherAlerts(farm, crops, livestock, currentWeather, userId)
      alerts.push(...currentAlerts)

      // Check forecast alerts
      const forecastAlerts = await this.checkForecastAlerts(farm, crops, livestock, forecast, userId)
      alerts.push(...forecastAlerts)

      // Check agricultural timing alerts
      const timingAlerts = await this.checkAgriculturalTimingAlerts(
        farm,
        crops,
        livestock,
        currentWeather,
        forecast,
        userId,
      )
      alerts.push(...timingAlerts)

      // Save alerts and send notifications
      const savedAlerts = []
      for (const alertData of alerts) {
        try {
          const alert = await WeatherAlert.create(alertData)
          await this.sendAlertNotifications(alert)
          savedAlerts.push(alert)
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
   * Check current weather conditions for alerts
   */
  async checkCurrentWeatherAlerts(farm, crops, livestock, currentWeather, userId) {
    const alerts = []
    const data = currentWeather.data

    // Extreme heat alert
    if (data.temperature_2m > this.alertThresholds.extreme_heat.temperature) {
      alerts.push({
        farm: farm._id,
        user: userId,
        alertType: "extreme_heat",
        severity: "warning",
        title: "Extreme Heat Warning",
        message: `Temperature has reached ${data.temperature_2m}°C. Take immediate action to protect crops and livestock from heat stress.`,
        weatherData: { current: data },
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
          {
            action: "Avoid heavy farm work during peak hours",
            priority: "medium",
            timeframe: "today",
            estimatedCost: 0,
          },
        ],
        validFrom: new Date(),
        validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000),
        confidence: 95,
      })
    }

    // Heavy rain alert
    if (data.precipitation > this.alertThresholds.heavy_rain.precipitation) {
      alerts.push({
        farm: farm._id,
        user: userId,
        alertType: "heavy_rain",
        severity: "advisory",
        title: "Heavy Rainfall Alert",
        message: `Heavy rainfall detected (${data.precipitation}mm). Ensure proper drainage and protect sensitive crops.`,
        weatherData: { current: data },
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
          {
            action: "Harvest mature crops if possible",
            priority: "high",
            timeframe: "immediate",
            estimatedCost: 100,
            potentialLoss: 500,
          },
        ],
        validFrom: new Date(),
        validUntil: new Date(Date.now() + 12 * 60 * 60 * 1000),
        confidence: 90,
      })
    }

    // Drought conditions
    if (data.soil_moisture_0_1cm < this.alertThresholds.drought.soilMoisture) {
      alerts.push({
        farm: farm._id,
        user: userId,
        alertType: "drought",
        severity: "watch",
        title: "Low Soil Moisture Alert",
        message: `Soil moisture is critically low at ${data.soil_moisture_0_1cm}%. Immediate irrigation required to prevent crop failure.`,
        weatherData: { current: data },
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
          {
            action: "Consider drought-resistant crop varieties for next season",
            priority: "low",
            timeframe: "planning",
            estimatedCost: 200,
          },
        ],
        validFrom: new Date(),
        validUntil: new Date(Date.now() + 48 * 60 * 60 * 1000),
        confidence: 85,
      })
    }

    // Strong wind alert
    if (data.wind_speed_10m > this.alertThresholds.strong_wind.windSpeed) {
      alerts.push({
        farm: farm._id,
        user: userId,
        alertType: "strong_wind",
        severity: "advisory",
        title: "Strong Wind Alert",
        message: `Strong winds detected (${data.wind_speed_10m} km/h). Secure loose items and check for structural damage.`,
        weatherData: { current: data },
        affectedCrops: crops.filter((c) => c.category === "tree_crops").map((c) => c._id),
        affectedLivestock: livestock.map((l) => l._id),
        recommendedActions: [
          {
            action: "Secure loose equipment and materials",
            priority: "high",
            timeframe: "immediate",
            estimatedCost: 0,
          },
          {
            action: "Check greenhouse and structure integrity",
            priority: "medium",
            timeframe: "within 2 hours",
            estimatedCost: 0,
          },
          {
            action: "Provide windbreaks for livestock",
            priority: "medium",
            timeframe: "within 4 hours",
            estimatedCost: 25,
          },
        ],
        validFrom: new Date(),
        validUntil: new Date(Date.now() + 8 * 60 * 60 * 1000),
        confidence: 80,
      })
    }

    return alerts
  }

  /**
   * Check forecast for upcoming weather alerts
   */
  async checkForecastAlerts(farm, crops, livestock, forecast, userId) {
    const alerts = []

    try {
      const next3Days = forecast.daily.slice(0, 3)

      for (let i = 0; i < next3Days.length; i++) {
        const day = next3Days[i]
        const alertDate = new Date()
        alertDate.setDate(alertDate.getDate() + i + 1)

        // Frost warning
        if (day.data.temperature_2m_min < 2) {
          alerts.push({
            farm: farm._id,
            user: userId,
            alertType: "frost",
            severity: "warning",
            title: `Frost Warning - Day ${i + 1}`,
            message: `Frost conditions expected with minimum temperature of ${day.data.temperature_2m_min}°C. Protect sensitive crops.`,
            weatherData: { forecast: day.data },
            affectedCrops: crops.filter((c) => c.frostSensitive).map((c) => c._id),
            recommendedActions: [
              {
                action: "Cover sensitive plants with frost cloth",
                priority: "high",
                timeframe: "before evening",
                estimatedCost: 75,
                potentialLoss: 300,
              },
              {
                action: "Move potted plants to shelter",
                priority: "medium",
                timeframe: "before evening",
                estimatedCost: 0,
              },
              {
                action: "Run irrigation system to prevent freezing",
                priority: "medium",
                timeframe: "overnight",
                estimatedCost: 20,
              },
            ],
            validFrom: new Date(),
            validUntil: alertDate,
            confidence: 75,
          })
        }

        // Heavy rain forecast
        if (day.data.precipitation_sum > 30) {
          alerts.push({
            farm: farm._id,
            user: userId,
            alertType: "heavy_rain",
            severity: "advisory",
            title: `Heavy Rain Forecast - Day ${i + 1}`,
            message: `Heavy rainfall expected (${day.data.precipitation_sum}mm). Prepare drainage and protect crops.`,
            weatherData: { forecast: day.data },
            affectedCrops: crops.map((c) => c._id),
            affectedLivestock: livestock.map((l) => l._id),
            recommendedActions: [
              {
                action: "Prepare and clear drainage systems",
                priority: "high",
                timeframe: "within 24 hours",
                estimatedCost: 30,
              },
              {
                action: "Harvest ready crops before rain",
                priority: "high",
                timeframe: "within 24 hours",
                estimatedCost: 150,
                potentialLoss: 400,
              },
              {
                action: "Secure livestock shelter",
                priority: "medium",
                timeframe: "within 24 hours",
                estimatedCost: 0,
              },
            ],
            validFrom: new Date(),
            validUntil: alertDate,
            confidence: 70,
          })
        }

        // Flood risk
        if (day.data.precipitation_sum > 50) {
          alerts.push({
            farm: farm._id,
            user: userId,
            alertType: "flood_risk",
            severity: "emergency",
            title: `Flood Risk - Day ${i + 1}`,
            message: `Extreme rainfall expected (${day.data.precipitation_sum}mm). High flood risk. Take immediate precautions.`,
            weatherData: { forecast: day.data },
            affectedCrops: crops.map((c) => c._id),
            affectedLivestock: livestock.map((l) => l._id),
            recommendedActions: [
              {
                action: "Move livestock to higher ground",
                priority: "critical",
                timeframe: "immediate",
                estimatedCost: 0,
                potentialLoss: 2000,
              },
              {
                action: "Secure or move valuable equipment",
                priority: "critical",
                timeframe: "immediate",
                estimatedCost: 0,
                potentialLoss: 1500,
              },
              {
                action: "Create emergency drainage channels",
                priority: "high",
                timeframe: "within 12 hours",
                estimatedCost: 100,
              },
            ],
            validFrom: new Date(),
            validUntil: alertDate,
            confidence: 85,
          })
        }
      }
    } catch (error) {
      logger.error("Error checking forecast alerts:", error)
    }

    return alerts
  }

  /**
   * Check for agricultural timing alerts
   */
  async checkAgriculturalTimingAlerts(farm, crops, livestock, currentWeather, forecast, userId) {
    const alerts = []

    try {
      // Optimal planting conditions
      const temp = currentWeather.data.temperature_2m
      const soilMoisture = currentWeather.data.soil_moisture_0_1cm
      const upcomingRain = forecast.daily.slice(0, 3).reduce((sum, day) => sum + (day.data.precipitation_sum || 0), 0)

      if (temp >= 15 && temp <= 25 && soilMoisture >= 40 && soilMoisture <= 70 && upcomingRain < 20) {
        alerts.push({
          farm: farm._id,
          user: userId,
          alertType: "optimal_planting",
          severity: "info",
          title: "Optimal Planting Conditions",
          message: `Excellent conditions for planting: Temperature ${temp}°C, soil moisture ${soilMoisture}%, minimal rain expected.`,
          weatherData: { current: currentWeather.data, forecast: forecast.daily.slice(0, 3) },
          recommendedActions: [
            {
              action: "Plant temperature-sensitive crops",
              priority: "medium",
              timeframe: "within 48 hours",
              estimatedCost: 200,
            },
            {
              action: "Prepare seedbeds for next planting cycle",
              priority: "low",
              timeframe: "within 1 week",
              estimatedCost: 50,
            },
          ],
          validFrom: new Date(),
          validUntil: new Date(Date.now() + 48 * 60 * 60 * 1000),
          confidence: 80,
        })
      }

      // Optimal harvesting conditions
      if (temp >= 20 && temp <= 30 && upcomingRain < 10 && currentWeather.data.wind_speed_10m < 15) {
        const matureCrops = crops.filter((c) => c.daysToHarvest && c.daysToHarvest <= 5)
        if (matureCrops.length > 0) {
          alerts.push({
            farm: farm._id,
            user: userId,
            alertType: "optimal_harvesting",
            severity: "info",
            title: "Optimal Harvesting Conditions",
            message: `Perfect weather for harvesting: dry conditions, moderate temperature, low wind. ${matureCrops.length} crops ready.`,
            weatherData: { current: currentWeather.data, forecast: forecast.daily.slice(0, 3) },
            affectedCrops: matureCrops.map((c) => c._id),
            recommendedActions: [
              {
                action: "Harvest mature crops immediately",
                priority: "high",
                timeframe: "within 24 hours",
                estimatedCost: 150,
                potentialLoss: 300,
              },
              {
                action: "Prepare storage and drying facilities",
                priority: "medium",
                timeframe: "immediate",
                estimatedCost: 50,
              },
            ],
            validFrom: new Date(),
            validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000),
            confidence: 85,
          })
        }
      }

      // Irrigation needed alert
      if (soilMoisture < 30 && upcomingRain < 5) {
        alerts.push({
          farm: farm._id,
          user: userId,
          alertType: "irrigation_needed",
          severity: "advisory",
          title: "Irrigation Recommended",
          message: `Low soil moisture (${soilMoisture}%) and no rain expected. Irrigation recommended to maintain crop health.`,
          weatherData: { current: currentWeather.data, forecast: forecast.daily.slice(0, 3) },
          affectedCrops: crops.map((c) => c._id),
          recommendedActions: [
            {
              action: "Schedule irrigation for all crops",
              priority: "medium",
              timeframe: "within 24 hours",
              estimatedCost: 75,
            },
            {
              action: "Check irrigation system efficiency",
              priority: "low",
              timeframe: "within 1 week",
              estimatedCost: 25,
            },
          ],
          validFrom: new Date(),
          validUntil: new Date(Date.now() + 48 * 60 * 60 * 1000),
          confidence: 75,
        })
      }

      // Pest risk alert
      if (temp > 25 && currentWeather.data.relative_humidity_2m > 70) {
        alerts.push({
          farm: farm._id,
          user: userId,
          alertType: "pest_risk",
          severity: "advisory",
          title: "Increased Pest Risk",
          message: `High temperature (${temp}°C) and humidity (${currentWeather.data.relative_humidity_2m}%) create favorable conditions for pest development.`,
          weatherData: { current: currentWeather.data },
          affectedCrops: crops.map((c) => c._id),
          recommendedActions: [
            {
              action: "Increase pest monitoring frequency",
              priority: "medium",
              timeframe: "immediate",
              estimatedCost: 0,
            },
            {
              action: "Prepare pest control measures",
              priority: "low",
              timeframe: "within 48 hours",
              estimatedCost: 100,
            },
            {
              action: "Check beneficial insect populations",
              priority: "low",
              timeframe: "within 1 week",
              estimatedCost: 0,
            },
          ],
          validFrom: new Date(),
          validUntil: new Date(Date.now() + 72 * 60 * 60 * 1000),
          confidence: 70,
        })
      }
    } catch (error) {
      logger.error("Error checking agricultural timing alerts:", error)
    }

    return alerts
  }

  /**
   * Send alert notifications
   */
  async sendAlertNotifications(alert) {
    try {
      const user = await alert.populate("user", "email phone notificationPreferences")

      // Determine notification methods based on severity and user preferences
      const methods = this.getNotificationMethods(alert.severity, user.notificationPreferences)

      for (const method of methods) {
        try {
          let success = false
          let recipient = ""

          switch (method) {
            case "email":
              if (user.email) {
                await notificationService.sendEmailAlert(user.email, alert)
                success = true
                recipient = user.email
              }
              break
            case "sms":
              if (user.phone) {
                await notificationService.sendSMSAlert(user.phone, alert)
                success = true
                recipient = user.phone
              }
              break
            case "push":
              await notificationService.sendPushAlert(user._id, alert)
              success = true
              recipient = user._id.toString()
              break
          }

          // Record notification attempt
          await alert.addNotification({
            method,
            successful: success,
            recipient,
          })
        } catch (error) {
          logger.error(`Error sending ${method} notification:`, error)
          await alert.addNotification({
            method,
            successful: false,
            recipient: "",
          })
        }
      }
    } catch (error) {
      logger.error("Error sending alert notifications:", error)
    }
  }

  /**
   * Get notification methods based on severity
   */
  getNotificationMethods(severity, userPreferences = {}) {
    const defaultMethods = {
      info: ["push"],
      advisory: ["push", "email"],
      watch: ["push", "email"],
      warning: ["push", "email", "sms"],
      emergency: ["push", "email", "sms"],
    }

    const methods = defaultMethods[severity] || ["push"]

    // Filter based on user preferences
    if (userPreferences) {
      return methods.filter((method) => userPreferences[method] !== false)
    }

    return methods
  }

  /**
   * Create tasks from alert recommendations
   */
  async createTasksFromAlert(alertId, userId, selectedActions = []) {
    try {
      const alert = await WeatherAlert.findById(alertId)
      if (!alert) {
        throw new Error("Alert not found")
      }

      const tasks = []
      const actionsToImplement = selectedActions.length > 0 ? selectedActions : alert.recommendedActions

      for (const action of actionsToImplement) {
        const taskData = {
          farm: alert.farm,
          user: userId,
          taskDate: this.getTaskDateFromTimeframe(action.timeframe),
          category: this.getCategoryFromAction(action.action),
          title: action.action,
          description: `Weather alert task: ${action.action}. Alert: ${alert.title}`,
          priority: action.priority,
          estimatedDuration: { value: 30, unit: "minutes" },
          weatherDependent: true,
          relatedAlerts: [alertId],
          aiGenerated: true,
          aiConfidence: alert.confidence,
        }

        if (alert.affectedCrops.length > 0) {
          taskData.crop = alert.affectedCrops[0]
        }
        if (alert.affectedLivestock.length > 0) {
          taskData.livestock = alert.affectedLivestock[0]
        }

        const task = await DailyTask.create(taskData)
        tasks.push(task)
      }

      // Update alert with related tasks
      alert.relatedTasks = tasks.map((t) => t._id)
      await alert.save()

      return tasks
    } catch (error) {
      logger.error("Error creating tasks from alert:", error)
      throw new Error(`Failed to create tasks: ${error.message}`)
    }
  }

  /**
   * Get task date from timeframe
   */
  getTaskDateFromTimeframe(timeframe) {
    const now = new Date()

    switch (timeframe) {
      case "immediate":
        return now
      case "within 2 hours":
        return new Date(now.getTime() + 2 * 60 * 60 * 1000)
      case "within 24 hours":
        return new Date(now.getTime() + 24 * 60 * 60 * 1000)
      case "within 48 hours":
        return new Date(now.getTime() + 48 * 60 * 60 * 1000)
      case "within 1 week":
        return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
      default:
        return now
    }
  }

  /**
   * Get task category from action
   */
  getCategoryFromAction(action) {
    const actionLower = action.toLowerCase()

    if (actionLower.includes("irrigation") || actionLower.includes("water")) return "irrigation"
    if (actionLower.includes("harvest")) return "harvesting"
    if (actionLower.includes("pest")) return "pest_control"
    if (actionLower.includes("feed") || actionLower.includes("livestock")) return "feeding"
    if (actionLower.includes("shelter") || actionLower.includes("secure")) return "maintenance"
    if (actionLower.includes("plant")) return "planting"
    if (actionLower.includes("health") || actionLower.includes("vet")) return "health_check"

    return "weather_response"
  }

  /**
   * Get alerts by farm and status
   */
  async getAlertsByFarm(farmId, options = {}) {
    try {
      const query = { farm: farmId }

      if (options.isActive !== undefined) {
        query.isActive = options.isActive
      }

      if (options.severity) {
        query.severity = options.severity
      }

      if (options.alertType) {
        query.alertType = options.alertType
      }

      if (options.validUntil) {
        query.validUntil = { $gte: new Date() }
      }

      const alerts = await WeatherAlert.find(query)
        .populate("affectedCrops", "name category")
        .populate("affectedLivestock", "herdName animalType")
        .populate("relatedTasks", "title status priority")
        .sort({ severity: -1, createdAt: -1 })

      return alerts
    } catch (error) {
      logger.error("Error fetching alerts by farm:", error)
      throw new Error(`Failed to fetch alerts: ${error.message}`)
    }
  }

  /**
   * Expire old alerts
   */
  async expireOldAlerts() {
    try {
      const result = await WeatherAlert.updateMany(
        {
          validUntil: { $lt: new Date() },
          isActive: true,
        },
        {
          $set: { isActive: false },
        },
      )

      logger.info(`Expired ${result.modifiedCount} old weather alerts`)
      return result
    } catch (error) {
      logger.error("Error expiring old alerts:", error)
      throw new Error(`Failed to expire alerts: ${error.message}`)
    }
  }
}

export const weatherAlertService = new WeatherAlertService()
