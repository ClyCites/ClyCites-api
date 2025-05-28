import express from "express"
import Weather from "../models/Weather.js"
import { ApiResponse } from "../utils/apiResponse.js"
import { logger } from "../utils/logger.js"

const router = express.Router()

// Get all active alerts for user
router.get("/", async (req, res) => {
  try {
    const userId = req.user.id
    const { type, severity } = req.query

    const query = {
      userId,
      "alerts.isActive": true,
      "alerts.endTime": { $gt: new Date() },
    }

    const weatherData = await Weather.find(query)
      .select("alerts location dataQuality.lastUpdated")
      .sort({ "dataQuality.lastUpdated": -1 })

    const allAlerts = weatherData.reduce((alerts, weather) => {
      const activeAlerts = weather.alerts
        .filter((alert) => {
          if (!alert.isActive || new Date(alert.endTime) <= new Date()) return false
          if (type && alert.type !== type) return false
          if (severity && alert.severity !== severity) return false
          return true
        })
        .map((alert) => ({
          ...alert.toObject(),
          location: weather.location,
          weatherId: weather._id,
        }))
      return alerts.concat(activeAlerts)
    }, [])

    // Sort by severity and start time
    const severityOrder = { critical: 4, high: 3, moderate: 2, low: 1 }
    allAlerts.sort((a, b) => {
      const severityDiff = severityOrder[b.severity] - severityOrder[a.severity]
      if (severityDiff !== 0) return severityDiff
      return new Date(a.startTime) - new Date(b.startTime)
    })

    res.json(ApiResponse.success(allAlerts, "Alerts retrieved successfully"))
  } catch (error) {
    logger.error("Error in alerts GET:", error)
    res.status(500).json(ApiResponse.error(error.message))
  }
})

// Mark alert as read/dismissed
router.patch("/:alertId/dismiss", async (req, res) => {
  try {
    const { alertId } = req.params
    const userId = req.user.id

    const result = await Weather.updateOne(
      {
        userId,
        "alerts._id": alertId,
      },
      {
        $set: { "alerts.$.isActive": false },
      },
    )

    if (result.matchedCount === 0) {
      return res.status(404).json(ApiResponse.error("Alert not found"))
    }

    res.json(ApiResponse.success(null, "Alert dismissed successfully"))
  } catch (error) {
    logger.error("Error in alert dismiss:", error)
    res.status(500).json(ApiResponse.error(error.message))
  }
})

// Get alert statistics
router.get("/stats", async (req, res) => {
  try {
    const userId = req.user.id

    const stats = await Weather.aggregate([
      { $match: { userId: userId } },
      { $unwind: "$alerts" },
      { $match: { "alerts.isActive": true, "alerts.endTime": { $gt: new Date() } } },
      {
        $group: {
          _id: {
            type: "$alerts.type",
            severity: "$alerts.severity",
          },
          count: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: "$_id.type",
          severities: {
            $push: {
              severity: "$_id.severity",
              count: "$count",
            },
          },
          total: { $sum: "$count" },
        },
      },
    ])

    res.json(ApiResponse.success(stats, "Alert statistics retrieved successfully"))
  } catch (error) {
    logger.error("Error in alert stats:", error)
    res.status(500).json(ApiResponse.error(error.message))
  }
})

export default router
