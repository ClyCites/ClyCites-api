import express from "express"
import { body, param, validationResult } from "express-validator"
import { Alert } from "../models/alert.model.js"
import { Farm } from "../models/farm.model.js"
import { queueService } from "../services/queue.service.js"
import { logger } from "../utils/logger.js"

const router = express.Router()

// Create alert
router.post(
  "/",
  [
    body("farmId").isMongoId(),
    body("type").isIn(["frost", "heat", "drought", "heavy_rain", "wind", "hail", "custom"]),
    body("name").trim().isLength({ min: 1 }),
    body("conditions").isObject(),
    body("notifications.email").optional().isBoolean(),
    body("notifications.sms").optional().isBoolean(),
    body("notifications.push").optional().isBoolean(),
    body("userId").optional().trim(),
    body("userEmail").optional().isEmail(),
    body("phoneNumber").optional().trim(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation errors",
          errors: errors.array(),
        })
      }

      // Verify farm exists
      const farm = await Farm.findOne({
        _id: req.body.farmId,
        isActive: true,
      })

      if (!farm) {
        return res.status(404).json({
          success: false,
          message: "Farm not found",
        })
      }

      const alertData = {
        ...req.body,
        userId: req.body.userId || "default-user",
      }

      const alert = new Alert(alertData)
      await alert.save()

      // Schedule alert checking
      await queueService.addAlertCheckJob({
        alertId: alert._id,
        farmId: alert.farmId,
        userId: alert.userId,
        userEmail: req.body.userEmail || "default@example.com",
        phoneNumber: req.body.phoneNumber || "",
      })

      logger.info(`New alert created: ${alert.name} for farm ${farm.name}`)

      res.status(201).json({
        success: true,
        message: "Alert created successfully",
        data: alert,
      })
    } catch (error) {
      logger.error("Error creating alert:", error)
      res.status(500).json({
        success: false,
        message: "Failed to create alert",
      })
    }
  },
)

// Get alerts (optionally filter by userId or farmId)
router.get("/", async (req, res) => {
  try {
    const { userId, farmId } = req.query
    const filter = {}

    if (userId) {
      filter.userId = userId
    }

    if (farmId) {
      filter.farmId = farmId
    }

    const alerts = await Alert.find(filter).populate("farmId", "name location").sort({ createdAt: -1 })

    res.json({
      success: true,
      message: "Alerts retrieved successfully",
      data: alerts,
    })
  } catch (error) {
    logger.error("Error fetching alerts:", error)
    res.status(500).json({
      success: false,
      message: "Failed to fetch alerts",
    })
  }
})

// Get alerts for specific farm
router.get("/farm/:farmId", [param("farmId").isMongoId()], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Invalid farm ID",
      })
    }

    // Verify farm exists
    const farm = await Farm.findOne({
      _id: req.params.farmId,
      isActive: true,
    })

    if (!farm) {
      return res.status(404).json({
        success: false,
        message: "Farm not found",
      })
    }

    const alerts = await Alert.find({
      farmId: req.params.farmId,
    }).sort({ createdAt: -1 })

    res.json({
      success: true,
      message: "Farm alerts retrieved successfully",
      data: alerts,
    })
  } catch (error) {
    logger.error("Error fetching farm alerts:", error)
    res.status(500).json({
      success: false,
      message: "Failed to fetch farm alerts",
    })
  }
})

// Update alert
router.put(
  "/:id",
  [
    param("id").isMongoId(),
    body("name").optional().trim().isLength({ min: 1 }),
    body("conditions").optional().isObject(),
    body("notifications").optional().isObject(),
    body("isActive").optional().isBoolean(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation errors",
          errors: errors.array(),
        })
      }

      const alert = await Alert.findOneAndUpdate({ _id: req.params.id }, req.body, {
        new: true,
        runValidators: true,
      })

      if (!alert) {
        return res.status(404).json({
          success: false,
          message: "Alert not found",
        })
      }

      res.json({
        success: true,
        message: "Alert updated successfully",
        data: alert,
      })
    } catch (error) {
      logger.error("Error updating alert:", error)
      res.status(500).json({
        success: false,
        message: "Failed to update alert",
      })
    }
  },
)

// Delete alert
router.delete("/:id", [param("id").isMongoId()], async (req, res) => {
  try {
    const alert = await Alert.findOneAndDelete({
      _id: req.params.id,
    })

    if (!alert) {
      return res.status(404).json({
        success: false,
        message: "Alert not found",
      })
    }

    res.json({
      success: true,
      message: "Alert deleted successfully",
    })
  } catch (error) {
    logger.error("Error deleting alert:", error)
    res.status(500).json({
      success: false,
      message: "Failed to delete alert",
    })
  }
})

export default router
