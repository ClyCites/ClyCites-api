import express from "express"
import { body } from "express-validator"
import {
  createFarm,
  getOrganizationFarms,
  getFarmDetails,
  generateFarmRecommendations,
  updateFarm,
} from "../controllers/farmController.js"
import { protect } from "../middlewares/authMiddleware.js"

const router = express.Router()

// Validation rules
const farmValidation = [
  body("name").trim().isLength({ min: 2, max: 100 }).withMessage("Farm name must be between 2 and 100 characters"),
  body("location.latitude").isFloat({ min: -90, max: 90 }).withMessage("Valid latitude is required"),
  body("location.longitude").isFloat({ min: -180, max: 180 }).withMessage("Valid longitude is required"),
  body("location.address").optional().isLength({ max: 200 }).withMessage("Address cannot exceed 200 characters"),
  body("size.value").isFloat({ min: 0 }).withMessage("Farm size must be a positive number"),
  body("size.unit").isIn(["hectares", "acres", "square_meters"]).withMessage("Invalid size unit"),
  body("soilType")
    .optional()
    .isIn(["clay", "sandy", "loam", "silt", "peat", "chalk", "mixed"])
    .withMessage("Invalid soil type"),
  body("soilPH").optional().isFloat({ min: 0, max: 14 }).withMessage("Soil pH must be between 0 and 14"),
  body("irrigationSystem")
    .optional()
    .isIn(["drip", "sprinkler", "flood", "furrow", "center_pivot", "none"])
    .withMessage("Invalid irrigation system"),
  body("farmType")
    .isIn(["crop", "livestock", "mixed", "aquaculture", "poultry", "dairy"])
    .withMessage("Invalid farm type"),
]

// All routes require authentication
router.use(protect)

// Farm routes
router.route("/organizations/:orgId/farms").get(getOrganizationFarms).post(farmValidation, createFarm)

router.route("/farms/:farmId").get(getFarmDetails).put(farmValidation, updateFarm)

router.route("/farms/:farmId/recommendations").post(generateFarmRecommendations)

export default router
