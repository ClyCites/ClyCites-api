import { weatherService } from "./weather.service.js"
import { aiRecommendationService } from "./ai-recommendation.service.js"
import { notificationService } from "./notification.service.js"
import { Alert } from "../models/alert.model.js"
import { Farm } from "../models/farm.model.js"
import { logger } from "../utils/logger.js"

// Create a simple in-memory queue for development
class SimpleQueue {
  constructor(name) {
    this.name = name
    this.jobs = []
    this.handlers = {}
  }

  async add(jobId, data, options = {}) {
    const job = { id: jobId, data, options }
    this.jobs.push(job)

    // Process immediately for simplicity
    if (this.handlers[jobId]) {
      try {
        await this.handlers[jobId](job)
      } catch (error) {
        logger.error(`Error processing job ${jobId}:`, error)
      }
    }

    return job
  }

  process(jobId, handler) {
    this.handlers[jobId] = handler
  }
}

class QueueService {
  constructor() {
    // Initialize simple in-memory queues
    this.weatherQueue = new SimpleQueue("weather-updates")
    this.alertQueue = new SimpleQueue("alert-checks")
    this.recommendationQueue = new SimpleQueue("recommendations")
    this.notificationQueue = new SimpleQueue("notifications")

    // Set up handlers
    this.weatherQueue.process("weather-update", async (job) => {
      await this.processWeatherUpdate(job.data)
    })

    this.alertQueue.process("alert-check", async (job) => {
      await this.processAlertCheck(job.data)
    })

    this.recommendationQueue.process("recommendation", async (job) => {
      await this.processRecommendationGeneration(job.data)
    })

    this.notificationQueue.process("notification", async (job) => {
      await this.processNotification(job.data)
    })
  }

  async initializeWorkers() {
    logger.info("Queue workers initialized")
  }

  // Schedule recurring jobs
  async scheduleRecurringJobs() {
    // For development, we'll just log that jobs would be scheduled
    logger.info("Recurring jobs would be scheduled in production")
  }

  // Add jobs to queues
  async addWeatherUpdateJob(data) {
    await this.weatherQueue.add("weather-update", data)
  }

  async addAlertCheckJob(data) {
    await this.alertQueue.add("alert-check", data)
  }

  async addRecommendationJob(data) {
    await this.recommendationQueue.add("recommendation", data)
  }

  async addNotificationJob(data) {
    await this.notificationQueue.add("notification", data)
  }

  // Job processors
  async processWeatherUpdate(data) {
    try {
      logger.info(`Processing weather update for farm ${data.farmId}`)

      // Fetch current weather and forecast
      await weatherService.getCurrentWeather(data.latitude, data.longitude)
      await weatherService.getForecast(data.latitude, data.longitude, 7)

      logger.info(`Weather update completed for farm ${data.farmId}`)
    } catch (error) {
      logger.error(`Error processing weather update for farm ${data.farmId}:`, error)
      throw error
    }
  }

  async processAlertCheck(data) {
    try {
      logger.info(`Processing alert check for alert ${data.alertId}`)

      const alert = await Alert.findById(data.alertId)
      const farm = await Farm.findById(data.farmId)

      if (!alert || !farm || !alert.isActive) {
        return
      }

      // Get current weather
      const currentWeather = await weatherService.getCurrentWeather(farm.location.latitude, farm.location.longitude)

      // Check if alert conditions are met
      const triggered = this.checkAlertConditions(alert, currentWeather)

      if (triggered) {
        // Prevent duplicate alerts within 1 hour
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
        if (alert.lastTriggered && alert.lastTriggered > oneHourAgo) {
          return
        }

        // Update last triggered time
        alert.lastTriggered = new Date()
        await alert.save()

        // Send notifications
        const payload = {
          title: `Weather Alert: ${alert.name}`,
          message: this.generateAlertMessage(alert, currentWeather),
          type: "alert",
          priority: this.getAlertPriority(alert, currentWeather),
        }

        if (alert.notifications.email) {
          await this.addNotificationJob({
            type: "email",
            userEmail: data.userEmail,
            payload,
          })
        }
        if (alert.notifications.sms) {
          await this.addNotificationJob({
            type: "sms",
            phoneNumber: data.phoneNumber,
            payload,
          })
        }
        if (alert.notifications.push) {
          await this.addNotificationJob({
            type: "push",
            userId: data.userId,
            payload,
          })
        }

        logger.info(`Alert ${data.alertId} triggered and notifications sent`)
      }
    } catch (error) {
      logger.error(`Error processing alert check for alert ${data.alertId}:`, error)
      throw error
    }
  }

  async processRecommendationGeneration(data) {
    try {
      logger.info(`Processing recommendation generation for farm ${data.farmId}`)

      const farm = await Farm.findById(data.farmId)

      if (!farm) {
        return
      }

      // Generate recommendations
      const recommendations = await aiRecommendationService.generateDailyRecommendations(farm)

      // Send high priority recommendations as notifications
      const highPriorityRecs = recommendations.filter((rec) => rec.priority === "high" || rec.priority === "urgent")

      for (const rec of highPriorityRecs) {
        const payload = {
          title: rec.title,
          message: rec.description,
          type: "recommendation",
          priority: rec.priority,
        }

        // Send email notification for high priority recommendations
        await this.addNotificationJob({
          type: "email",
          userEmail: data.userEmail,
          payload,
        })
      }

      logger.info(`Recommendation generation completed for farm ${data.farmId}`)
    } catch (error) {
      logger.error(`Error processing recommendation generation for farm ${data.farmId}:`, error)
      throw error
    }
  }

  async processNotification(data) {
    try {
      const { type, payload } = data

      // Localize message if needed
      const localizedPayload = notificationService.generateLocalizedMessage(payload, data.language || "en")

      switch (type) {
        case "email":
          await notificationService.sendEmail(data.userEmail, localizedPayload)
          break
        case "sms":
          await notificationService.sendSMS(data.phoneNumber, localizedPayload)
          break
        case "push":
          await notificationService.sendPushNotification(data.userId, localizedPayload)
          break
        default:
          logger.warn(`Unknown notification type: ${type}`)
      }

      logger.info(`${type} notification sent`)
    } catch (error) {
      logger.error(`Error processing ${data.type} notification:`, error)
      throw error
    }
  }

  checkAlertConditions(alert, weatherData) {
    const conditions = alert.conditions
    const weather = weatherData.data

    // Check temperature conditions
    if (conditions.temperature) {
      if (conditions.temperature.min !== undefined && weather.temperature < conditions.temperature.min) {
        return true
      }
      if (conditions.temperature.max !== undefined && weather.temperature > conditions.temperature.max) {
        return true
      }
    }

    // Check humidity conditions
    if (conditions.humidity) {
      if (conditions.humidity.min !== undefined && weather.humidity < conditions.humidity.min) {
        return true
      }
      if (conditions.humidity.max !== undefined && weather.humidity > conditions.humidity.max) {
        return true
      }
    }

    // Check precipitation conditions
    if (conditions.precipitation) {
      if (conditions.precipitation.min !== undefined && weather.precipitation < conditions.precipitation.min) {
        return true
      }
      if (conditions.precipitation.max !== undefined && weather.precipitation > conditions.precipitation.max) {
        return true
      }
    }

    // Check wind speed conditions
    if (conditions.windSpeed) {
      if (conditions.windSpeed.min !== undefined && weather.windSpeed < conditions.windSpeed.min) {
        return true
      }
      if (conditions.windSpeed.max !== undefined && weather.windSpeed > conditions.windSpeed.max) {
        return true
      }
    }

    return false
  }

  generateAlertMessage(alert, weatherData) {
    const weather = weatherData.data
    return `Alert "${alert.name}" has been triggered. Current conditions: Temperature ${weather.temperature}°C, Humidity ${weather.humidity}%, Precipitation ${weather.precipitation}mm, Wind ${weather.windSpeed}km/h. Please check your farm and take appropriate action.`
  }

  getAlertPriority(alert, weatherData) {
    const weather = weatherData.data

    // Determine priority based on severity of conditions
    if (alert.type === "frost" && weather.temperature < 0) return "urgent"
    if (alert.type === "heat" && weather.temperature > 40) return "urgent"
    if (alert.type === "heavy_rain" && weather.precipitation > 100) return "high"
    if (alert.type === "wind" && weather.windSpeed > 50) return "high"

    return "medium"
  }
}

export const queueService = new QueueService()

export async function initializeQueues() {
  await queueService.initializeWorkers()
  await queueService.scheduleRecurringJobs()
}
