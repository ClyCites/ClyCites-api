import { generateText } from "ai"
import { openai } from "@ai-sdk/openai"
import Farm from "../models/farmModel.js"
import Crop from "../models/cropModel.js"
import Livestock from "../models/livestockModel.js"
import FarmInput from "../models/farmInputModel.js"
import FarmWorker from "../models/farmWorkerModel.js"
import FarmAlert from "../models/farmAlertModel.js"
import DailyTask from "../models/dailyTaskModel.js"
import AgricultureActivity from "../models/agricultureActivityModel.js"
import { weatherService } from "./weatherService.js"
import { aiServiceValidator } from "./aiServiceValidator.js"
import logger from "../utils/logger.js"

class SmartAssistantService {
  constructor() {
    if (aiServiceValidator.isAIEnabled()) {
      this.model = openai("gpt-4o")
    } else {
      this.model = null
      logger.warn("⚠️  Smart Assistant disabled - OpenAI API key not configured")
    }
  }

  /**
   * Generate comprehensive farm dashboard data
   */
  async generateFarmDashboard(farmId, userId) {
    try {
      const farm = await Farm.findById(farmId).populate("owner organization")
      if (!farm) {
        throw new Error("Farm not found")
      }

      // Get current date ranges
      const now = new Date()
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      const startOfYear = new Date(now.getFullYear(), 0, 1)

      // Fetch all farm data in parallel
      const [crops, livestock, workers, inputs, alerts, tasks, activities, weather, forecast] = await Promise.all([
        Crop.find({ farm: farmId }).sort({ createdAt: -1 }),
        Livestock.find({ farm: farmId, isActive: true }),
        FarmWorker.find({ farm: farmId, status: "active" }),
        FarmInput.find({ farm: farmId, isActive: true }),
        FarmAlert.getActiveAlerts(farmId),
        DailyTask.find({
          farm: farmId,
          taskDate: { $gte: startOfWeek },
        }).populate("crop livestock"),
        AgricultureActivity.find({
          farm: farmId,
          actualDate: { $gte: startOfMonth },
        }).populate("crop performedBy"),
        weatherService.getCurrentWeather(farm.location.latitude, farm.location.longitude, [
          "temperature_2m",
          "relative_humidity_2m",
          "precipitation",
          "wind_speed_10m",
          "soil_moisture_0_1cm",
        ]),
        weatherService.getForecast(farm.location.latitude, farm.location.longitude, {
          dailyVariables: ["temperature_2m_max", "temperature_2m_min", "precipitation_sum"],
          days: 7,
        }),
      ])

      // Generate analytics
      const analytics = await this.generateFarmAnalytics(
        farm,
        crops,
        livestock,
        workers,
        inputs,
        alerts,
        tasks,
        activities,
        startOfMonth,
        now,
      )

      // Generate AI insights
      const insights = await this.generateAIInsights(farm, crops, livestock, workers, inputs, alerts, weather, forecast)

      // Generate recommendations
      const recommendations = await this.generateSmartRecommendations(
        farm,
        crops,
        livestock,
        workers,
        inputs,
        weather,
        forecast,
        analytics,
      )

      return {
        farm: {
          id: farm._id,
          name: farm.name,
          type: farm.farmType,
          size: farm.size,
          location: farm.location,
        },
        overview: {
          totalCrops: crops.length,
          activeCrops: crops.filter((c) => ["planted", "growing"].includes(c.status)).length,
          totalLivestock: livestock.length,
          totalAnimals: livestock.reduce((sum, l) => sum + l.totalAnimals, 0),
          activeWorkers: workers.length,
          activeAlerts: alerts.length,
          criticalAlerts: alerts.filter((a) => ["critical", "emergency"].includes(a.severity)).length,
          pendingTasks: tasks.filter((t) => t.status === "pending").length,
          completedTasks: tasks.filter((t) => t.status === "completed").length,
        },
        weather: {
          current: weather.data,
          forecast: forecast.daily.slice(0, 3),
          alerts: alerts.filter((a) => a.alertType.startsWith("weather_")),
        },
        analytics,
        insights,
        recommendations,
        alerts: alerts.slice(0, 10), // Top 10 alerts
        recentActivities: activities.slice(0, 10),
        upcomingTasks: tasks
          .filter((t) => t.status === "pending")
          .sort((a, b) => b.urgencyScore - a.urgencyScore)
          .slice(0, 10),
      }
    } catch (error) {
      logger.error("Error generating farm dashboard:", error)
      throw new Error(`Failed to generate dashboard: ${error.message}`)
    }
  }

  /**
   * Generate farm analytics
   */
  async generateFarmAnalytics(farm, crops, livestock, workers, inputs, alerts, tasks, activities, startDate, endDate) {
    try {
      // Cost analysis
      const inputCosts = inputs.reduce((sum, input) => {
        const monthlyUsage = input.usage.filter((u) => u.date >= startDate && u.date <= endDate)
        return (
          sum +
          monthlyUsage.reduce((usageSum, usage) => {
            return usageSum + usage.quantity * input.purchaseInfo.unitCost
          }, 0)
        )
      }, 0)

      const laborCosts = activities.reduce((sum, activity) => {
        return sum + (activity.labor?.totalCost || 0)
      }, 0)

      const equipmentCosts = activities.reduce((sum, activity) => {
        return sum + activity.equipment.reduce((eqSum, eq) => eqSum + (eq.maintenanceCost || 0), 0)
      }, 0)

      // Production analysis
      const cropProduction = crops.reduce((sum, crop) => {
        return sum + (crop.actualYield?.quantity || 0)
      }, 0)

      const livestockProduction = livestock.reduce((sum, animal) => {
        return sum + (animal.production?.dailyProduction?.quantity || 0) * 30 // Monthly estimate
      }, 0)

      // Worker productivity
      const workerProductivity = workers.map((worker) => ({
        id: worker._id,
        name: worker.fullName,
        tasksCompleted: worker.monthlyTasksCompleted,
        attendanceRate: worker.currentMonthAttendance.attendanceRate,
        performance: worker.performance.currentRating,
      }))

      // Alert analysis
      const alertAnalysis = {
        total: alerts.length,
        bySeverity: alerts.reduce((acc, alert) => {
          acc[alert.severity] = (acc[alert.severity] || 0) + 1
          return acc
        }, {}),
        byType: alerts.reduce((acc, alert) => {
          const category = alert.alertType.split("_")[0]
          acc[category] = (acc[category] || 0) + 1
          return acc
        }, {}),
        avgResponseTime: alerts.reduce((sum, alert) => sum + (alert.metrics?.responseTime || 0), 0) / alerts.length,
      }

      // Task completion analysis
      const taskAnalysis = {
        total: tasks.length,
        completed: tasks.filter((t) => t.status === "completed").length,
        pending: tasks.filter((t) => t.status === "pending").length,
        overdue: tasks.filter((t) => t.isOverdue).length,
        completionRate:
          tasks.length > 0
            ? Math.round((tasks.filter((t) => t.status === "completed").length / tasks.length) * 100)
            : 0,
      }

      // Resource utilization
      const resourceUtilization = {
        inputs: inputs.map((input) => ({
          name: input.inputName,
          type: input.inputType,
          stockLevel: input.stockPercentage,
          utilizationRate: (input.totalUsed / input.purchaseInfo.quantity) * 100,
          costEfficiency: input.costPerUnitUsed,
        })),
        equipment: activities.reduce((acc, activity) => {
          activity.equipment.forEach((eq) => {
            if (!acc[eq.name]) {
              acc[eq.name] = { totalHours: 0, fuelConsumption: 0, maintenanceCost: 0 }
            }
            acc[eq.name].totalHours += eq.operatingHours || 0
            acc[eq.name].fuelConsumption += eq.fuelConsumption || 0
            acc[eq.name].maintenanceCost += eq.maintenanceCost || 0
          })
          return acc
        }, {}),
      }

      return {
        costs: {
          inputs: inputCosts,
          labor: laborCosts,
          equipment: equipmentCosts,
          total: inputCosts + laborCosts + equipmentCosts,
        },
        production: {
          crops: cropProduction,
          livestock: livestockProduction,
          total: cropProduction + livestockProduction,
        },
        workers: workerProductivity,
        alerts: alertAnalysis,
        tasks: taskAnalysis,
        resources: resourceUtilization,
        efficiency: {
          costPerUnit: cropProduction > 0 ? (inputCosts + laborCosts + equipmentCosts) / cropProduction : 0,
          workerProductivity: workerProductivity.reduce((sum, w) => sum + w.tasksCompleted, 0) / workers.length,
          alertResolutionRate: (alerts.filter((a) => a.status === "resolved").length / alerts.length) * 100,
        },
      }
    } catch (error) {
      logger.error("Error generating farm analytics:", error)
      return {}
    }
  }

  /**
   * Generate AI insights
   */
  async generateAIInsights(farm, crops, livestock, workers, inputs, alerts, weather, forecast) {
    try {
      if (!aiServiceValidator.isAIEnabled()) {
        return this.generateBasicInsights(farm, crops, livestock, workers, inputs, alerts, weather)
      }

      const prompt = `
        As an agricultural AI expert, analyze this farm data and provide 5-7 key insights:
        
        Farm: ${farm.name} (${farm.farmType})
        Size: ${farm.size.value} ${farm.size.unit}
        
        Current Status:
        - Crops: ${crops.length} total, ${crops.filter((c) => ["planted", "growing"].includes(c.status)).length} active
        - Livestock: ${livestock.length} groups, ${livestock.reduce((sum, l) => sum + l.totalAnimals, 0)} total animals
        - Workers: ${workers.length} active
        - Active Alerts: ${alerts.length}
        - Critical Alerts: ${alerts.filter((a) => ["critical", "emergency"].includes(a.severity)).length}
        
        Weather: ${weather.data.temperature_2m}°C, ${weather.data.relative_humidity_2m}% humidity, ${weather.data.precipitation}mm rain
        
        Recent Issues:
        ${alerts
          .slice(0, 5)
          .map((a) => `- ${a.title} (${a.severity})`)
          .join("\n")}
        
        Input Status:
        ${inputs
          .filter((i) => i.isLowStock || i.isExpired)
          .map((i) => `- ${i.inputName}: ${i.isExpired ? "EXPIRED" : "LOW STOCK"}`)
          .join("\n")}
        
        Provide insights on:
        1. Overall farm health and performance
        2. Critical issues requiring immediate attention
        3. Resource optimization opportunities
        4. Weather impact and preparations needed
        5. Worker productivity and management
        6. Cost efficiency improvements
        7. Growth and expansion opportunities
        
        Format each insight as:
        CATEGORY: [category]
        INSIGHT: [brief insight]
        IMPACT: [high/medium/low]
        ACTION: [recommended action]
      `

      const { text } = await generateText({
        model: this.model,
        prompt,
        maxTokens: 1200,
      })

      return this.parseAIInsights(text)
    } catch (error) {
      logger.error("Error generating AI insights:", error)
      return this.generateBasicInsights(farm, crops, livestock, workers, inputs, alerts, weather)
    }
  }

  /**
   * Generate basic insights without AI
   */
  generateBasicInsights(farm, crops, livestock, workers, inputs, alerts, weather) {
    const insights = []

    // Critical alerts insight
    const criticalAlerts = alerts.filter((a) => ["critical", "emergency"].includes(a.severity))
    if (criticalAlerts.length > 0) {
      insights.push({
        category: "alerts",
        insight: `${criticalAlerts.length} critical alerts require immediate attention`,
        impact: "high",
        action: "Review and address critical alerts immediately",
        priority: 10,
      })
    }

    // Low stock insight
    const lowStockItems = inputs.filter((i) => i.isLowStock)
    if (lowStockItems.length > 0) {
      insights.push({
        category: "inventory",
        insight: `${lowStockItems.length} items are running low on stock`,
        impact: "medium",
        action: "Reorder low stock items to avoid disruptions",
        priority: 7,
      })
    }

    // Expired items insight
    const expiredItems = inputs.filter((i) => i.isExpired)
    if (expiredItems.length > 0) {
      insights.push({
        category: "inventory",
        insight: `${expiredItems.length} items have expired and need disposal`,
        impact: "medium",
        action: "Safely dispose of expired items and update inventory",
        priority: 6,
      })
    }

    // Weather insight
    if (weather.data.temperature_2m > 35) {
      insights.push({
        category: "weather",
        insight: "Extreme heat conditions detected",
        impact: "high",
        action: "Increase irrigation and provide shade for crops and livestock",
        priority: 9,
      })
    }

    // Crop harvest insight
    const harvestReady = crops.filter((c) => c.daysToHarvest && c.daysToHarvest <= 7)
    if (harvestReady.length > 0) {
      insights.push({
        category: "crops",
        insight: `${harvestReady.length} crops are ready for harvest`,
        impact: "high",
        action: "Prepare harvesting equipment and labor",
        priority: 8,
      })
    }

    // Worker productivity insight
    const lowPerformanceWorkers = workers.filter((w) => w.performance.currentRating < 3)
    if (lowPerformanceWorkers.length > 0) {
      insights.push({
        category: "workforce",
        insight: `${lowPerformanceWorkers.length} workers need performance improvement`,
        impact: "medium",
        action: "Provide additional training and support",
        priority: 5,
      })
    }

    return insights.sort((a, b) => b.priority - a.priority)
  }

  /**
   * Parse AI insights from text response
   */
  parseAIInsights(text) {
    const insights = []
    const sections = text.split("CATEGORY:").filter((section) => section.trim().length > 0)

    for (const section of sections) {
      const lines = section.split("\n").map((line) => line.trim())

      const category = lines[0]
        ?.replace(/^\d+\.?\s*/, "")
        .trim()
        .toLowerCase()
      let insight = ""
      let impact = "medium"
      let action = ""

      for (const line of lines) {
        if (line.startsWith("INSIGHT:")) {
          insight = line.replace("INSIGHT:", "").trim()
        } else if (line.startsWith("IMPACT:")) {
          impact = line.replace("IMPACT:", "").trim().toLowerCase()
        } else if (line.startsWith("ACTION:")) {
          action = line.replace("ACTION:", "").trim()
        }
      }

      if (category && insight && action) {
        const priority = impact === "high" ? 8 : impact === "medium" ? 5 : 3
        insights.push({
          category,
          insight: insight.substring(0, 200),
          impact,
          action: action.substring(0, 200),
          priority,
        })
      }
    }

    return insights.sort((a, b) => b.priority - a.priority)
  }

  /**
   * Generate smart recommendations
   */
  async generateSmartRecommendations(farm, crops, livestock, workers, inputs, weather, forecast, analytics) {
    try {
      const recommendations = []

      // Weather-based recommendations
      const weatherRecs = await this.generateWeatherRecommendations(farm, crops, livestock, weather, forecast)
      recommendations.push(...weatherRecs)

      // Cost optimization recommendations
      const costRecs = this.generateCostOptimizationRecommendations(analytics, inputs)
      recommendations.push(...costRecs)

      // Productivity recommendations
      const productivityRecs = this.generateProductivityRecommendations(workers, analytics)
      recommendations.push(...productivityRecs)

      // Resource management recommendations
      const resourceRecs = this.generateResourceRecommendations(inputs, crops, livestock)
      recommendations.push(...resourceRecs)

      // Crop management recommendations
      const cropRecs = this.generateCropRecommendations(crops, weather, forecast)
      recommendations.push(...cropRecs)

      // Livestock management recommendations
      const livestockRecs = this.generateLivestockRecommendations(livestock, weather)
      recommendations.push(...livestockRecs)

      return recommendations.sort((a, b) => b.priority - a.priority).slice(0, 15) // Top 15 recommendations
    } catch (error) {
      logger.error("Error generating smart recommendations:", error)
      return []
    }
  }

  /**
   * Generate weather-based recommendations
   */
  async generateWeatherRecommendations(farm, crops, livestock, weather, forecast) {
    const recommendations = []
    const temp = weather.data.temperature_2m
    const humidity = weather.data.relative_humidity_2m
    const soilMoisture = weather.data.soil_moisture_0_1cm
    const upcomingRain = forecast.daily.slice(0, 3).reduce((sum, day) => sum + (day.data.precipitation_sum || 0), 0)

    if (temp > 35) {
      recommendations.push({
        type: "weather_response",
        title: "Extreme Heat Protection",
        description: `Temperature is ${temp}°C. Implement heat stress prevention measures.`,
        priority: 9,
        timeframe: "immediate",
        estimatedCost: 200,
        potentialSaving: 1000,
        actions: [
          "Increase irrigation frequency",
          "Provide shade for livestock",
          "Adjust work schedules to cooler hours",
          "Monitor crops and animals for heat stress",
        ],
        affectedEntities: {
          crops: crops.map((c) => c._id),
          livestock: livestock.map((l) => l._id),
        },
      })
    }

    if (soilMoisture < 30 && upcomingRain < 10) {
      recommendations.push({
        type: "irrigation",
        title: "Urgent Irrigation Required",
        description: `Soil moisture is critically low at ${soilMoisture}% with minimal rain expected.`,
        priority: 8,
        timeframe: "within_24h",
        estimatedCost: 150,
        potentialSaving: 2000,
        actions: [
          "Implement emergency irrigation",
          "Prioritize water-stressed crops",
          "Check irrigation system efficiency",
          "Apply mulch to conserve moisture",
        ],
        affectedEntities: {
          crops: crops.filter((c) => ["planted", "growing"].includes(c.status)).map((c) => c._id),
          livestock: livestock.map((l) => l._id),
        },
      })
    }

    if (upcomingRain > 30) {
      recommendations.push({
        type: "weather_preparation",
        title: "Heavy Rain Preparation",
        description: `${upcomingRain}mm of rain expected in next 3 days. Prepare drainage and protection.`,
        priority: 7,
        timeframe: "within_24h",
        estimatedCost: 100,
        potentialSaving: 800,
        actions: [
          "Clear drainage systems",
          "Harvest mature crops if possible",
          "Secure livestock shelter",
          "Protect sensitive equipment",
        ],
        affectedEntities: {
          crops: crops.map((c) => c._id),
          livestock: livestock.map((l) => l._id),
        },
      })
    }

    return recommendations
  }

  /**
   * Generate cost optimization recommendations
   */
  generateCostOptimizationRecommendations(analytics, inputs) {
    const recommendations = []

    // Input cost optimization
    const highCostInputs = inputs.filter((i) => i.costPerUnitUsed > analytics.efficiency.costPerUnit)
    if (highCostInputs.length > 0) {
      recommendations.push({
        type: "cost_optimization",
        title: "High-Cost Input Management",
        description: `Some inputs are costing more than average per unit used.`,
        priority: 6,
        timeframe: "ongoing",
        estimatedCost: 0,
        potentialSaving: highCostInputs.reduce(
          (sum, i) => sum + i.totalUsed * (analytics.efficiency.costPerUnit - i.costPerUnitUsed),
          0,
        ),
        actions: [
          "Review input usage and efficiency",
          "Consider alternative inputs with lower costs",
          "Optimize input application methods",
        ],
        affectedEntities: {
          inputs: highCostInputs.map((i) => i._id),
        },
      })
    }

    return recommendations
  }

  /**
   * Generate productivity recommendations
   */
  generateProductivityRecommendations(workers, analytics) {
    const recommendations = []

    // Worker productivity improvement
    const lowProductivityWorkers = workers.filter((w) => w.tasksCompleted < analytics.efficiency.workerProductivity)
    if (lowProductivityWorkers.length > 0) {
      recommendations.push({
        type: "productivity",
        title: "Worker Productivity Improvement",
        description: `Some workers are completing fewer tasks than average.`,
        priority: 5,
        timeframe: "ongoing",
        estimatedCost: 0,
        potentialSaving: lowProductivityWorkers.reduce(
          (sum, w) => sum + (analytics.efficiency.workerProductivity - w.tasksCompleted) * 100,
          0,
        ), // Assuming $100 per task
        actions: [
          "Provide additional training",
          "Implement performance tracking and feedback",
          "Optimize task assignments for efficiency",
        ],
        affectedEntities: {
          workers: lowProductivityWorkers.map((w) => w._id),
        },
      })
    }

    return recommendations
  }

  /**
   * Generate resource management recommendations
   */
  generateResourceRecommendations(inputs, crops, livestock) {
    const recommendations = []

    // Input stock management
    const lowStockInputs = inputs.filter((i) => i.stockPercentage < 20)
    if (lowStockInputs.length > 0) {
      recommendations.push({
        type: "resource_management",
        title: "Low Stock Input Reordering",
        description: `Some inputs are running low on stock.`,
        priority: 4,
        timeframe: "within_7d",
        estimatedCost: lowStockInputs.reduce(
          (sum, i) => sum + (i.purchaseInfo.quantity - i.totalUsed) * i.purchaseInfo.unitCost,
          0,
        ),
        potentialSaving: 0,
        actions: ["Reorder low stock inputs", "Monitor stock levels regularly", "Optimize input usage to reduce waste"],
        affectedEntities: {
          inputs: lowStockInputs.map((i) => i._id),
        },
      })
    }

    // Livestock feed management
    const livestockFeedInputs = inputs.filter((i) => i.inputType === "feed")
    const highFeedUsageLivestock = livestock.filter(
      (l) => l.production?.dailyProduction?.quantity > 0 && l.totalAnimals > 0,
    )
    if (livestockFeedInputs.length > 0 && highFeedUsageLivestock.length > 0) {
      recommendations.push({
        type: "resource_management",
        title: "Optimize Livestock Feed Usage",
        description: `High feed usage by livestock groups detected.`,
        priority: 4,
        timeframe: "ongoing",
        estimatedCost: 0,
        potentialSaving: highFeedUsageLivestock.reduce(
          (sum, l) => sum + l.production.dailyProduction.quantity * l.totalAnimals * 0.1,
          0,
        ), // Assuming 10% reduction in feed usage
        actions: [
          "Review feed usage and efficiency",
          "Implement portion control for livestock feed",
          "Consider alternative feeds with better efficiency",
        ],
        affectedEntities: {
          livestock: highFeedUsageLivestock.map((l) => l._id),
          inputs: livestockFeedInputs.map((i) => i._id),
        },
      })
    }

    return recommendations
  }

  /**
   * Generate crop management recommendations
   */
  generateCropRecommendations(crops, weather, forecast) {
    const recommendations = []

    // Crop irrigation management
    const cropsNeedingIrrigation = crops.filter(
      (c) => c.status === "growing" && c.waterRequirement > weather.data.soil_moisture_0_1cm,
    )
    if (cropsNeedingIrrigation.length > 0) {
      recommendations.push({
        type: "crop_management",
        title: "Crop Irrigation Management",
        description: `Some growing crops need more irrigation based on soil moisture levels.`,
        priority: 3,
        timeframe: "within_7d",
        estimatedCost: cropsNeedingIrrigation.reduce((sum, c) => sum + c.waterRequirement * 0.1, 0), // Assuming $0.1 per unit of water
        potentialSaving: 0,
        actions: [
          "Increase irrigation for water-stressed crops",
          "Monitor soil moisture levels regularly",
          "Optimize irrigation schedules for efficiency",
        ],
        affectedEntities: {
          crops: cropsNeedingIrrigation.map((c) => c._id),
        },
      })
    }

    return recommendations
  }

  /**
   * Generate livestock management recommendations
   */
  generateLivestockRecommendations(livestock, weather) {
    const recommendations = []

    // Livestock shade management
    const livestockNeedingShade = livestock.filter((l) => l.totalAnimals > 0 && weather.data.temperature_2m > 30)
    if (livestockNeedingShade.length > 0) {
      recommendations.push({
        type: "livestock_management",
        title: "Livestock Shade Management",
        description: `High temperatures detected, livestock need shade to prevent heat stress.`,
        priority: 3,
        timeframe: "immediate",
        estimatedCost: 100,
        potentialSaving: 0,
        actions: [
          "Provide additional shade for livestock",
          "Monitor livestock for signs of heat stress",
          "Adjust feeding schedules to cooler hours",
        ],
        affectedEntities: {
          livestock: livestockNeedingShade.map((l) => l._id),
        },
      })
    }

    return recommendations
  }
}
