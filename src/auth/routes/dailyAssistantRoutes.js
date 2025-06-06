import express from "express"
import { body } from "express-validator"
import {
  getDailySummary,
  getFarmTasks,
  updateTaskStatus,
  createCustomTask,
  getWeatherAlerts,
  acknowledgeAlert,
  getTaskStatistics,
} from "../controllers/dailyAssistantController.js"
import { protect } from "../middlewares/authMiddleware.js"

const router = express.Router()

// Validation rules
const taskValidation = [
  body("title")
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage("Task title is required and cannot exceed 200 characters"),
  body("description")
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage("Task description is required and cannot exceed 1000 characters"),
  body("category")
    .isIn([
      "irrigation",
      "fertilization",
      "pest_control",
      "disease_control",
      "planting",
      "harvesting",
      "feeding",
      "health_check",
      "vaccination",
      "breeding",
      "cleaning",
      "maintenance",
      "monitoring",
      "marketing",
      "weather_response",
      "general",
    ])
    .withMessage("Invalid task category"),
  body("priority").isIn(["low", "medium", "high", "critical"]).withMessage("Invalid priority level"),
  body("taskDate").isISO8601().withMessage("Valid task date is required"),
]

const taskStatusValidation = [
  body("status")
    .isIn(["pending", "in_progress", "completed", "skipped", "postponed", "cancelled"])
    .withMessage("Invalid task status"),
]

// All routes require authentication
router.use(protect)

// Daily assistant routes
router.route("/farms/:farmId/daily-summary").get(getDailySummary)

router.route("/farms/:farmId/tasks").get(getFarmTasks).post(taskValidation, createCustomTask)

router.route("/tasks/:taskId/status").put(taskStatusValidation, updateTaskStatus)

router.route("/farms/:farmId/alerts").get(getWeatherAlerts)

router.route("/alerts/:alertId/acknowledge").put(acknowledgeAlert)

router.route("/farms/:farmId/task-stats").get(getTaskStatistics)

export default router
