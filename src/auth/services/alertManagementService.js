import FarmAlert from "../models/farmAlertModel.js"
import FarmInput from "../models/farmInputModel.js"
import FarmWorker from "../models/farmWorkerModel.js"
import Crop from "../models/cropModel.js"
import Livestock from "../models/livestockModel.js"
import DailyTask from "../models/dailyTaskModel.js"
import { notificationService } from "./notificationService.js"
import logger from "../utils/logger.js"

class AlertManagementService {
  /**
   * Monitor and generate alerts for all farm systems
   */
  async monitorFarmSystems(farmId) {
    try {
      const alerts = []

      // Monitor different farm systems
      const [inputAlerts, workerAlerts, cropAlerts, livestockAlerts, taskAlerts, weatherAlerts, equipmentAlerts] =
        await Promise.all([
          this.monitorInputs(farmId),
          this.monitorWorkers(farmId),
          this.monitorCrops(farmId),
          this.monitorLivestock(farmId),
          this.monitorTasks(farmId),
          this.monitorWeather(farmId),
          this.monitorEquipment(farmId),
        ])

      alerts.push(
        ...inputAlerts,
        ...workerAlerts,
        ...cropAlerts,
        ...livestockAlerts,
        ...taskAlerts,
        ...weatherAlerts,
        ...equipmentAlerts,
      )

      // Save new alerts
      const savedAlerts = []
      for (const alertData of alerts) {
        try {
          const existingAlert = await FarmAlert.findOne({
            farm: farmId,
            alertType: alertData.alertType,
            status: { $in: ["active", "acknowledged"] },
            "relatedEntities.crops": { $in: alertData.relatedEntities?.crops || [] },
            "relatedEntities.livestock": { $in: alertData.relatedEntities?.livestock || [] },
            "relatedEntities.inputs": { $in: alertData.relatedEntities?.inputs || [] },
            "relatedEntities.workers": { $in: alertData.relatedEntities?.workers || [] },
          })

          if (!existingAlert) {
            const alert = await FarmAlert.create(alertData)
            savedAlerts.push(alert)

            // Send notifications for critical alerts
            if (["critical", "emergency"].includes(alert.severity)) {
              await this.sendAlertNotifications(alert)
            }
          }
        } catch (error) {
          logger.error("Error saving alert:", error)
        }
      }

      return savedAlerts
    } catch (error) {
      logger.error("Error monitoring farm systems:", error)
      return []
    }
  }

  /**
   * Monitor farm inputs for low stock, expiry, etc.
   */
  async monitorInputs(farmId) {
    const alerts = []

    try {
      const inputs = await FarmInput.find({ farm: farmId, isActive: true })

      for (const input of inputs) {
        const inputAlerts = input.checkAlerts()

        for (const alertInfo of inputAlerts) {
          alerts.push({
            farm: farmId,
            user: input.farm.owner, // Will be populated later
            alertType: `input_${alertInfo.type}`,
            severity: alertInfo.priority === "high" ? "warning" : "advisory",
            priority: alertInfo.priority === "high" ? 8 : 5,
            title: alertInfo.message,
            message: `${input.inputName}: ${alertInfo.message}`,
            source: "system",
            relatedEntities: {
              inputs: [input._id],
            },
            data: {
              inputId: input._id,
              inputName: input.inputName,
              inputType: input.inputType,
              currentStock: input.currentStock,
              minimumStock: input.minimumStock,
              expiryDate: input.expiryDate,
            },
            recommendedActions: [
              {
                action:
                  alertInfo.type === "low_stock"
                    ? "Reorder this input to maintain adequate stock levels"
                    : "Safely dispose of expired input and update inventory",
                priority: "medium",
                timeframe: alertInfo.type === "expired" ? "immediate" : "within_week",
                estimatedCost: input.purchaseInfo.unitCost * (input.minimumStock - input.currentStock),
              },
            ],
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
          })
        }
      }
    } catch (error) {
      logger.error("Error monitoring inputs:", error)
    }

    return alerts
  }

  /**
   * Monitor farm workers for attendance, performance, etc.
   */
  async monitorWorkers(farmId) {
    const alerts = []

    try {
      const workers = await FarmWorker.find({ farm: farmId, status: "active" })

      for (const worker of workers) {
        const attendance = worker.currentMonthAttendance

        // Low attendance alert
        if (attendance.attendanceRate < 80) {
          alerts.push({
            farm: farmId,
            user: worker.farm.owner,
            alertType: "worker_attendance_low",
            severity: "advisory",
            priority: 6,
            title: "Low Worker Attendance",
            message: `${worker.fullName} has low attendance rate (${attendance.attendanceRate}%)`,
            source: "system",
            relatedEntities: {
              workers: [worker._id],
            },
            data: {
              workerId: worker._id,
              workerName: worker.fullName,
              attendanceRate: attendance.attendanceRate,
              absentDays: attendance.absentDays,
            },
            recommendedActions: [
              {
                action: "Discuss attendance issues with worker and provide support if needed",
                priority: "medium",
                timeframe: "within_week",
              },
            ],
          })
        }

        // Low performance alert
        if (worker.performance.currentRating < 3) {
          alerts.push({
            farm: farmId,
            user: worker.farm.owner,
            alertType: "worker_performance_issue",
            severity: "advisory",
            priority: 5,
            title: "Worker Performance Issue",
            message: `${worker.fullName} has low performance rating (${worker.performance.currentRating}/5)`,
            source: "system",
            relatedEntities: {
              workers: [worker._id],
            },
            data: {
              workerId: worker._id,
              workerName: worker.fullName,
              currentRating: worker.performance.currentRating,
            },
            recommendedActions: [
              {
                action: "Provide additional training and performance improvement plan",
                priority: "medium",
                timeframe: "within_week",
              },
            ],
          })
        }

        // Safety incident alert
        const recentIncidents = worker.healthSafety.incidents.filter(
          (incident) => incident.date > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        )

        if (recentIncidents.length > 0) {
          const severeIncidents = recentIncidents.filter((incident) =>
            ["severe", "critical"].includes(incident.severity),
          )

          if (severeIncidents.length > 0) {
            alerts.push({
              farm: farmId,
              user: worker.farm.owner,
              alertType: "worker_safety_incident",
              severity: "warning",
              priority: 8,
              title: "Worker Safety Incident",
              message: `${worker.fullName} has recent safety incidents requiring attention`,
              source: "system",
              relatedEntities: {
                workers: [worker._id],
              },
              data: {
                workerId: worker._id,
                workerName: worker.fullName,
                incidentCount: severeIncidents.length,
                latestIncident: severeIncidents[0],
              },
              recommendedActions: [
                {
                  action: "Review safety protocols and provide additional safety training",
                  priority: "high",
                  timeframe: "immediate",
                },
              ],
            })
          }
        }
      }
    } catch (error) {
      logger.error("Error monitoring workers:", error)
    }

    return alerts
  }

  /**
   * Monitor crops for diseases, pests, harvest timing, etc.
   */
  async monitorCrops(farmId) {
    const alerts = []

    try {
      const crops = await Crop.find({ farm: farmId, status: { $in: ["planted", "growing"] } })

      for (const crop of crops) {
        // Harvest ready alert
        if (crop.daysToHarvest && crop.daysToHarvest <= 3 && crop.daysToHarvest > 0) {
          alerts.push({
            farm: farmId,
            user: crop.farm.owner,
            alertType: "crop_harvest_ready",
            severity: "info",
            priority: 7,
            title: "Crop Ready for Harvest",
            message: `${crop.name} is ready for harvest in ${crop.daysToHarvest} days`,
            source: "system",
            relatedEntities: {
              crops: [crop._id],
            },
            data: {
              cropId: crop._id,
              cropName: crop.name,
              category: crop.category,
              daysToHarvest: crop.daysToHarvest,
              expectedYield: crop.expectedYield,
            },
            recommendedActions: [
              {
                action: "Prepare harvesting equipment and arrange labor",
                priority: "high",
                timeframe: "within_24h",
                estimatedCost: 200,
              },
              {
                action: "Check market prices for optimal selling timing",
                priority: "medium",
                timeframe: "immediate",
              },
            ],
          })
        }

        // Overdue harvest alert
        if (crop.daysToHarvest && crop.daysToHarvest < 0) {
          alerts.push({
            farm: farmId,
            user: crop.farm.owner,
            alertType: "crop_harvest_overdue",
            severity: "warning",
            priority: 9,
            title: "Harvest Overdue",
            message: `${crop.name} harvest is overdue by ${Math.abs(crop.daysToHarvest)} days`,
            source: "system",
            relatedEntities: {
              crops: [crop._id],
            },
            data: {
              cropId: crop._id,
              cropName: crop.name,
              daysOverdue: Math.abs(crop.daysToHarvest),
            },
            recommendedActions: [
              {
                action: "Harvest immediately to prevent quality loss",
                priority: "critical",
                timeframe: "immediate",
                potentialImpact: "Crop quality degradation and financial loss",
              },
            ],
          })
        }

        // Growth stage monitoring
        if (crop.growthStage === "flowering" && crop.ageInDays > 90) {
          alerts.push({
            farm: farmId,
            user: crop.farm.owner,
            alertType: "crop_growth_anomaly",
            severity: "advisory",
            priority: 5,
            title: "Extended Flowering Period",
            message: `${crop.name} has been in flowering stage for extended period`,
            source: "system",
            relatedEntities: {
              crops: [crop._id],
            },
            data: {
              cropId: crop._id,
              cropName: crop.name,
              growthStage: crop.growthStage,
              ageInDays: crop.ageInDays,
            },
            recommendedActions: [
              {
                action: "Inspect crop for potential issues affecting development",
                priority: "medium",
                timeframe: "within_week",
              },
            ],
          })
        }
      }
    } catch (error) {
      logger.error("Error monitoring crops:", error)
    }

    return alerts
  }

  /**
   * Monitor livestock for health, production, vaccination, etc.
   */
  async monitorLivestock(farmId) {
    const alerts = []

    try {
      const livestock = await Livestock.find({ farm: farmId, isActive: true })

      for (const animal of livestock) {
        // Vaccination due alerts
        if (animal.health.upcomingVaccinations && animal.health.upcomingVaccinations.length > 0) {
          for (const vaccination of animal.health.upcomingVaccinations) {
            const daysUntilDue = Math.ceil((new Date(vaccination.nextDue) - new Date()) / (1000 * 60 * 60 * 24))

            if (daysUntilDue <= 7) {
              alerts.push({
                farm: farmId,
                user: animal.farm.owner,
                alertType: "livestock_vaccination_due",
                severity: daysUntilDue <= 3 ? "warning" : "advisory",
                priority: daysUntilDue <= 3 ? 8 : 6,
                title: "Livestock Vaccination Due",
                message: `${animal.herdName} vaccination (${vaccination.vaccine}) due in ${daysUntilDue} days`,
                source: "system",
                relatedEntities: {
                  livestock: [animal._id],
                },
                data: {
                  livestockId: animal._id,
                  herdName: animal.herdName,
                  animalType: animal.animalType,
                  vaccine: vaccination.vaccine,
                  dueDate: vaccination.nextDue,
                  priority: vaccination.priority,
                },
                recommendedActions: [
                  {
                    action: "Schedule vaccination appointment with veterinarian",
                    priority: "high",
                    timeframe: daysUntilDue <= 3 ? "immediate" : "within_24h",
                  },
                ],
              })
            }
          }
        }

        // Production drop alert
        if (animal.production && animal.production.productionGoals) {
          const currentProduction = animal.production.dailyProduction.quantity
          const targetProduction = animal.production.productionGoals.daily

          if (targetProduction > 0 && currentProduction < targetProduction * 0.8) {
            alerts.push({
              farm: farmId,
              user: animal.farm.owner,
              alertType: "livestock_production_drop",
              severity: "advisory",
              priority: 6,
              title: "Production Below Target",
              message: `${animal.herdName} production is ${Math.round(((targetProduction - currentProduction) / targetProduction) * 100)}% below target`,
              source: "system",
              relatedEntities: {
                livestock: [animal._id],
              },
              data: {
                livestockId: animal._id,
                herdName: animal.herdName,
                currentProduction,
                targetProduction,
                productionEfficiency: (currentProduction / targetProduction) * 100,
              },
              recommendedActions: [
                {
                  action: "Review feeding schedule and nutrition quality",
                  priority: "medium",
                  timeframe: "within_week",
                },
                {
                  action: "Check for health issues affecting production",
                  priority: "medium",
                  timeframe: "within_week",
                },
              ],
            })
          }
        }

        // Health issues alert
        if (animal.health.healthIssues && animal.health.healthIssues.length > 0) {
          const activeIssues = animal.health.healthIssues.filter((issue) => issue.status === "active")

          if (activeIssues.length > 0) {
            alerts.push({
              farm: farmId,
              user: animal.farm.owner,
              alertType: "livestock_health_issue",
              severity: "warning",
              priority: 7,
              title: "Livestock Health Issues",
              message: `${animal.herdName} has ${activeIssues.length} active health issue(s)`,
              source: "system",
              relatedEntities: {
                livestock: [animal._id],
              },
              data: {
                livestockId: animal._id,
                herdName: animal.herdName,
                healthIssues: activeIssues,
                issueCount: activeIssues.length,
              },
              recommendedActions: [
                {
                  action: "Consult veterinarian for treatment plan",
                  priority: "high",
                  timeframe: "within_24h",
                },
              ],
            })
          }
        }
      }
    } catch (error) {
      logger.error("Error monitoring livestock:", error)
    }

    return alerts
  }

  /**
   * Monitor tasks for overdue items, high workload, etc.
   */
  async monitorTasks(farmId) {
    const alerts = []

    try {
      const now = new Date()
      const overdueTasks = await DailyTask.find({
        farm: farmId,
        status: "pending",
        taskDate: { $lt: now },
      }).populate("crop livestock")

      if (overdueTasks.length > 0) {
        // Group overdue tasks by days overdue
        const criticalOverdue = overdueTasks.filter((task) => {
          const daysOverdue = Math.ceil((now - task.taskDate) / (1000 * 60 * 60 * 24))
          return daysOverdue > 3
        })

        if (criticalOverdue.length > 0) {
          alerts.push({
            farm: farmId,
            user: overdueTasks[0].user,
            alertType: "task_overdue",
            severity: "warning",
            priority: 8,
            title: "Critical Overdue Tasks",
            message: `${criticalOverdue.length} tasks are critically overdue (>3 days)`,
            source: "system",
            relatedEntities: {
              tasks: criticalOverdue.map((task) => task._id),
            },
            data: {
              overdueCount: criticalOverdue.length,
              totalOverdue: overdueTasks.length,
              oldestTask: {
                id: criticalOverdue[0]._id,
                title: criticalOverdue[0].title,
                daysOverdue: Math.ceil((now - criticalOverdue[0].taskDate) / (1000 * 60 * 60 * 24)),
              },
            },
            recommendedActions: [
              {
                action: "Prioritize completion of overdue tasks",
                priority: "high",
                timeframe: "immediate",
              },
              {
                action: "Review task scheduling and resource allocation",
                priority: "medium",
                timeframe: "within_week",
              },
            ],
          })
        }
      }

      // High workload alert
      const todaysTasks = await DailyTask.find({
        farm: farmId,
        taskDate: {
          $gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
          $lt: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1),
        },
        status: "pending",
      })

      const highPriorityTasks = todaysTasks.filter((task) => ["critical", "high"].includes(task.priority))

      if (highPriorityTasks.length > 5) {
        alerts.push({
          farm: farmId,
          user: todaysTasks[0]?.user,
          alertType: "task_high_workload",
          severity: "advisory",
          priority: 5,
          title: "High Priority Task Overload",
          message: `${highPriorityTasks.length} high-priority tasks scheduled for today`,
          source: "system",
          relatedEntities: {
            tasks: highPriorityTasks.map((task) => task._id),
          },
          data: {
            highPriorityCount: highPriorityTasks.length,
            totalTodayTasks: todaysTasks.length,
          },
          recommendedActions: [
            {
              action: "Consider redistributing tasks or extending deadlines",
              priority: "medium",
              timeframe: "immediate",
            },
            {
              action: "Assign additional workers if available",
              priority: "medium",
              timeframe: "immediate",
            },
          ],
        })
      }
    } catch (error) {
      logger.error("Error monitoring tasks:", error)
    }

    return alerts
  }

  /**
   * Monitor weather conditions for alerts
   */
  async monitorWeather(farmId) {
    const alerts = []

    try {
      // This would integrate with weather service
      // For now, return empty array as weather alerts are handled elsewhere
    } catch (error) {
      logger.error("Error monitoring weather:", error)
    }

    return alerts
  }

  /**
   * Monitor equipment for maintenance, malfunctions, etc.
   */
  async monitorEquipment(farmId) {
    const alerts = []

    try {
      // This would monitor equipment status from IoT sensors or manual reports
      // For now, return empty array as this requires additional equipment models
    } catch (error) {
      logger.error("Error monitoring equipment:", error)
    }

    return alerts
  }

  /**
   * Send alert notifications
   */
  async sendAlertNotifications(alert) {
    try {
      const user = await alert.populate("user", "email phone notificationPreferences")

      // Determine notification methods based on severity
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
            recipient,
            delivered: success,
          })
        } catch (error) {
          logger.error(`Error sending ${method} notification:`, error)
          await alert.addNotification({
            method,
            recipient: "",
            delivered: false,
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
      low: ["push"],
      medium: ["push", "email"],
      high: ["push", "email", "sms"],
      critical: ["push", "email", "sms"],
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
   * Process recurring alerts
   */
  async processRecurringAlerts() {
    try {
      await FarmAlert.createRecurringAlerts()
      logger.info("Processed recurring alerts")
    } catch (error) {
      logger.error("Error processing recurring alerts:", error)
    }
  }

  /**
   * Expire old alerts
   */
  async expireOldAlerts() {
    try {
      const result = await FarmAlert.expireOldAlerts()
      logger.info(`Expired ${result.modifiedCount} old alerts`)
      return result
    } catch (error) {
      logger.error("Error expiring old alerts:", error)
      return { modifiedCount: 0 }
    }
  }

  /**
   * Get alert dashboard data
   */
  async getAlertDashboard(farmId) {
    try {
      const [activeAlerts, criticalAlerts, recentAlerts, alertStats] = await Promise.all([
        FarmAlert.getActiveAlerts(farmId),
        FarmAlert.getCriticalAlerts(farmId),
        FarmAlert.find({ farm: farmId })
          .sort({ createdAt: -1 })
          .limit(10)
          .populate("relatedEntities.crops", "name category")
          .populate("relatedEntities.livestock", "herdName animalType"),
        this.getAlertStatistics(farmId),
      ])

      return {
        summary: {
          activeAlerts: activeAlerts.length,
          criticalAlerts: criticalAlerts.length,
          totalAlerts: recentAlerts.length,
          resolutionRate: alertStats.resolutionRate,
        },
        activeAlerts: activeAlerts.slice(0, 5), // Top 5 active alerts
        criticalAlerts,
        recentAlerts,
        statistics: alertStats,
      }
    } catch (error) {
      logger.error("Error getting alert dashboard:", error)
      return {
        summary: { activeAlerts: 0, criticalAlerts: 0, totalAlerts: 0, resolutionRate: 0 },
        activeAlerts: [],
        criticalAlerts: [],
        recentAlerts: [],
        statistics: {},
      }
    }
  }

  /**
   * Get alert statistics
   */
  async getAlertStatistics(farmId, days = 30) {
    try {
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
      const endDate = new Date()

      const [totalAlerts, resolvedAlerts, alertsByType, alertsBySeverity] = await Promise.all([
        FarmAlert.countDocuments({
          farm: farmId,
          createdAt: { $gte: startDate, $lte: endDate },
        }),
        FarmAlert.countDocuments({
          farm: farmId,
          status: "resolved",
          createdAt: { $gte: startDate, $lte: endDate },
        }),
        FarmAlert.aggregate([
          {
            $match: {
              farm: farmId,
              createdAt: { $gte: startDate, $lte: endDate },
            },
          },
          {
            $group: {
              _id: "$alertType",
              count: { $sum: 1 },
            },
          },
          { $sort: { count: -1 } },
        ]),
        FarmAlert.aggregate([
          {
            $match: {
              farm: farmId,
              createdAt: { $gte: startDate, $lte: endDate },
            },
          },
          {
            $group: {
              _id: "$severity",
              count: { $sum: 1 },
            },
          },
        ]),
      ])

      const resolutionRate = totalAlerts > 0 ? Math.round((resolvedAlerts / totalAlerts) * 100) : 0

      return {
        totalAlerts,
        resolvedAlerts,
        resolutionRate,
        alertsByType,
        alertsBySeverity,
        period: { days, startDate, endDate },
      }
    } catch (error) {
      logger.error("Error getting alert statistics:", error)
      return {
        totalAlerts: 0,
        resolvedAlerts: 0,
        resolutionRate: 0,
        alertsByType: [],
        alertsBySeverity: [],
      }
    }
  }
}

export const alertManagementService = new AlertManagementService()
