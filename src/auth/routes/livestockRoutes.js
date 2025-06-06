import express from "express"
import { body } from "express-validator"
import {
  createLivestock,
  getFarmLivestock,
  updateLivestock,
  getLivestockDetails,
  addLivestockRecord,
} from "../controllers/livestockController.js"
import { protect } from "../middlewares/authMiddleware.js"

const router = express.Router()

// Validation rules
const livestockValidation = [
  body("animalType")
    .isIn(["cattle", "goats", "sheep", "pigs", "poultry", "rabbits", "fish", "other"])
    .withMessage("Invalid animal type"),
  body("herdName")
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Herd name is required and cannot exceed 100 characters"),
  body("totalAnimals").isInt({ min: 1 }).withMessage("Total animals must be at least 1"),
  body("production.purpose")
    .isIn(["meat", "milk", "eggs", "breeding", "draft", "manure", "mixed"])
    .withMessage("Invalid production purpose"),
]

const recordValidation = [
  body("type")
    .isIn(["feeding", "health", "production", "breeding", "death", "sale", "purchase", "other"])
    .withMessage("Invalid record type"),
  body("description").trim().isLength({ min: 1, max: 500 }).withMessage("Description is required"),
]

// All routes require authentication
router.use(protect)

// Livestock routes
router.route("/farms/:farmId/livestock").get(getFarmLivestock).post(livestockValidation, createLivestock)

router.route("/livestock/:livestockId").get(getLivestockDetails).put(livestockValidation, updateLivestock)

router.route("/livestock/:livestockId/records").post(recordValidation, addLivestockRecord)

export default router
