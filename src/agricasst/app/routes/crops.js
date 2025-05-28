import express from "express"
import Crop from "../models/Crop.js"
import { ApiResponse } from "../utils/apiResponse.js"
import { logger } from "../utils/logger.js"

const router = express.Router()

// Get all crops
router.get("/", async (req, res) => {
  try {
    const { category, region, difficulty, search, page = 1, limit = 20 } = req.query

    const query = { isActive: true }

    if (category) query.category = category
    if (region) query.region = { $in: [region] }
    if (difficulty) query.difficulty = difficulty
    if (search) {
      query.$or = [
        { name: new RegExp(search, "i") },
        { commonNames: new RegExp(search, "i") },
        { scientificName: new RegExp(search, "i") },
      ]
    }

    const crops = await Crop.find(query)
      .select("name scientificName category difficulty marketInfo.demandLevel description")
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ name: 1 })

    const total = await Crop.countDocuments(query)

    res.json(
      ApiResponse.success(
        {
          crops,
          pagination: {
            current: page,
            pages: Math.ceil(total / limit),
            total,
          },
        },
        "Crops retrieved successfully",
      ),
    )
  } catch (error) {
    logger.error("Error in crops GET:", error)
    res.status(500).json(ApiResponse.error(error.message))
  }
})

// Get crop by ID
router.get("/:id", async (req, res) => {
  try {
    const crop = await Crop.findById(req.params.id)

    if (!crop) {
      return res.status(404).json(ApiResponse.error("Crop not found"))
    }

    res.json(ApiResponse.success(crop, "Crop retrieved successfully"))
  } catch (error) {
    logger.error("Error in crops GET by ID:", error)
    res.status(500).json(ApiResponse.error(error.message))
  }
})

// Search crops by name
router.get("/search/:name", async (req, res) => {
  try {
    const { name } = req.params

    const crops = await Crop.find({
      $or: [
        { name: new RegExp(name, "i") },
        { commonNames: new RegExp(name, "i") },
        { scientificName: new RegExp(name, "i") },
      ],
      isActive: true,
    }).select("name scientificName category description marketInfo.demandLevel")

    res.json(ApiResponse.success(crops, "Crops found successfully"))
  } catch (error) {
    logger.error("Error in crops search:", error)
    res.status(500).json(ApiResponse.error(error.message))
  }
})

// Get crop categories
router.get("/meta/categories", async (req, res) => {
  try {
    const categories = await Crop.distinct("category")
    const categoriesWithCount = await Promise.all(
      categories.map(async (category) => {
        const count = await Crop.countDocuments({ category, isActive: true })
        return { category, count }
      }),
    )

    res.json(ApiResponse.success(categoriesWithCount, "Categories retrieved successfully"))
  } catch (error) {
    logger.error("Error in crops categories:", error)
    res.status(500).json(ApiResponse.error(error.message))
  }
})

export default router
