import express from "express"
import { body } from "express-validator"
import {
  getWeatherAlerts,
  getWeatherAlert,
  acknowledgeWeatherAlert,
  implementAlertAction,
  createTasksFromAlert,
  getAlertStatistics,
  expireOldAlerts,
} from "../controllers/weatherAlertController.js"
import { protect } from "../middlewares/authMiddleware.js"

const router = express.Router()

// Validation rules
const implementActionValidation = [
  body("action").trim().isLength({ min: 1, max: 200 }).withMessage("Action description is required"),
  body("cost").optional().isNumeric().withMessage("Cost must be a number"),
  body("effectiveness")
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage("Effectiveness must be a number between 1 and 5"),
  body("notes").optional().isLength({ max: 500 }).withMessage("Notes cannot exceed 500 characters"),
]

// All routes require authentication
router.use(protect)

// Weather alert routes
router.route("/farms/:farmId/weather-alerts").get(getWeatherAlerts)

router.route("/farms/:farmId/weather-alerts/stats").get(getAlertStatistics)

router.route("/weather-alerts/:alertId").get(getWeatherAlert)

router.route("/weather-alerts/:alertId/acknowledge").put(acknowledgeWeatherAlert)

router.route("/weather-alerts/:alertId/implement-action").post(implementActionValidation, implementAlertAction)

router.route("/weather-alerts/:alertId/create-tasks").post(createTasksFromAlert)

// System/Admin routes
router.route("/weather-alerts/expire-old").post(expireOldAlerts)

export default router
