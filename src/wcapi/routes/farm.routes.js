import express from "express"
import { body, param, validationResult } from "express-validator"
import { Farm } from "../models/farm.model.js"
import { queueService } from "../services/queue.service.js"
import { logger } from "../utils/logger.js"

const router = express.Router()

// Create farm
router.post(
  "/",
  [
    body("name").trim().isLength({ min: 1 }),
    body("location.latitude").isFloat({ min: -90, max: 90 }),
    body("location.longitude").isFloat({ min: -180, max: 180 }),
    body("location.address").trim().isLength({ min: 1 }),
    body("location.country").trim().isLength({ min: 1 }),
    body("location.region").trim().isLength({ min: 1 }),
    body("size").isFloat({ min: 0 }),
    body("soilType").isIn(["clay", "sandy", "loam", "silt", "peat", "chalk"]),
    body("irrigationSystem").optional().isIn(["none", "drip", "sprinkler", "flood", "furrow"]),
    body("userId").optional().trim(),
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

      const farmData = {
        ...req.body,
        userId: req.body.userId || "default-user",
      }

      const farm = new Farm(farmData)
      await farm.save()

      // Schedule weather updates for this farm
      await queueService.addWeatherUpdateJob({
        farmId: farm._id,
        latitude: farm.location.latitude,
        longitude: farm.location.longitude,
      })

      logger.info(`New farm created: ${farm.name}`)

      res.status(201).json({
        success: true,
        message: "Farm created successfully",
        data: farm,
      })
    } catch (error) {
      logger.error("Error creating farm:", error)
      res.status(500).json({
        success: false,
        message: "Failed to create farm",
      })
    }
  },
)

// Get all farms (optionally filter by userId)
router.get("/", async (req, res) => {
  try {
    const { userId } = req.query
    const filter = { isActive: true }

    if (userId) {
      filter.userId = userId
    }

    const farms = await Farm.find(filter)

    res.json({
      success: true,
      message: "Farms retrieved successfully",
      data: farms,
    })
  } catch (error) {
    logger.error("Error fetching farms:", error)
    res.status(500).json({
      success: false,
      message: "Failed to fetch farms",
    })
  }
})

// Get specific farm
router.get("/:id", [param("id").isMongoId()], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Invalid farm ID",
      })
    }

    const farm = await Farm.findOne({
      _id: req.params.id,
      isActive: true,
    })

    if (!farm) {
      return res.status(404).json({
        success: false,
        message: "Farm not found",
      })
    }

    res.json({
      success: true,
      message: "Farm retrieved successfully",
      data: farm,
    })
  } catch (error) {
    logger.error("Error fetching farm:", error)
    res.status(500).json({
      success: false,
      message: "Failed to fetch farm",
    })
  }
})

// Update farm
router.put(
  "/:id",
  [
    param("id").isMongoId(),
    body("name").optional().trim().isLength({ min: 1 }),
    body("location.latitude").optional().isFloat({ min: -90, max: 90 }),
    body("location.longitude").optional().isFloat({ min: -180, max: 180 }),
    body("size").optional().isFloat({ min: 0 }),
    body("soilType").optional().isIn(["clay", "sandy", "loam", "silt", "peat", "chalk"]),
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

      const farm = await Farm.findOneAndUpdate({ _id: req.params.id }, req.body, {
        new: true,
        runValidators: true,
      })

      if (!farm) {
        return res.status(404).json({
          success: false,
          message: "Farm not found",
        })
      }

      res.json({
        success: true,
        message: "Farm updated successfully",
        data: farm,
      })
    } catch (error) {
      logger.error("Error updating farm:", error)
      res.status(500).json({
        success: false,
        message: "Failed to update farm",
      })
    }
  },
)

// Add crop to farm
router.post(
  "/:id/crops",
  [
    param("id").isMongoId(),
    body("type").isIn([
      "maize",
      "beans",
      "coffee",
      "banana",
      "cassava",
      "sweet_potato",
      "rice",
      "wheat",
      "tomato",
      "onion",
      "cabbage",
      "other",
    ]),
    body("variety").optional().trim(),
    body("plantingDate").optional().isISO8601(),
    body("harvestDate").optional().isISO8601(),
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

      const farm = await Farm.findOne({
        _id: req.params.id,
      })

      if (!farm) {
        return res.status(404).json({
          success: false,
          message: "Farm not found",
        })
      }

      farm.crops.push(req.body)
      await farm.save()

      res.json({
        success: true,
        message: "Crop added successfully",
        data: farm,
      })
    } catch (error) {
      logger.error("Error adding crop:", error)
      res.status(500).json({
        success: false,
        message: "Failed to add crop",
      })
    }
  },
)

// Delete farm
router.delete("/:id", [param("id").isMongoId()], async (req, res) => {
  try {
    const farm = await Farm.findOneAndUpdate({ _id: req.params.id }, { isActive: false }, { new: true })

    if (!farm) {
      return res.status(404).json({
        success: false,
        message: "Farm not found",
      })
    }

    res.json({
      success: true,
      message: "Farm deleted successfully",
    })
  } catch (error) {
    logger.error("Error deleting farm:", error)
    res.status(500).json({
      success: false,
      message: "Failed to delete farm",
    })
  }
})

export default router
