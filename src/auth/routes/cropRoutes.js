import express from "express"
import { body } from "express-validator"
import { createCrop, getFarmCrops, updateCrop, getCropDetails } from "../controllers/cropController.js"
import { protect } from "../middlewares/authMiddleware.js"

const router = express.Router()

// Validation rules
const cropValidation = [
  body("name")
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Crop name is required and cannot exceed 100 characters"),
  body("category")
    .isIn(["cereals", "legumes", "vegetables", "fruits", "cash_crops", "fodder", "spices", "other"])
    .withMessage("Invalid crop category"),
  body("plantingDate").isISO8601().withMessage("Valid planting date is required"),
  body("expectedHarvestDate").optional().isISO8601().withMessage("Valid expected harvest date required"),
  body("growthStage")
    .optional()
    .isIn([
      "seed",
      "germination",
      "seedling",
      "vegetative",
      "flowering",
      "fruiting",
      "maturity",
      "harvest",
      "post_harvest",
    ])
    .withMessage("Invalid growth stage"),
  body("plantingMethod")
    .optional()
    .isIn(["direct_seeding", "transplanting", "broadcasting", "drilling"])
    .withMessage("Invalid planting method"),
  body("field.area.value").optional().isFloat({ min: 0 }).withMessage("Field area must be a positive number"),
  body("field.area.unit").optional().isIn(["hectares", "acres", "square_meters"]).withMessage("Invalid area unit"),
]

// All routes require authentication
router.use(protect)

// Crop routes
router.route("/farms/:farmId/crops").get(getFarmCrops).post(cropValidation, createCrop)

router.route("/crops/:cropId").get(getCropDetails).put(cropValidation, updateCrop)

export default router
