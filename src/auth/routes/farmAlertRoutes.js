import express from "express"
import { body, param } from "express-validator"
import {
  createFarmAlert,
  getFarmAlerts,
  getFarmAlert,
  updateFarmAlert,
  acknowledgeFarmAlert,
  resolveFarmAlert,
  addAlertAction,
  getCriticalAlerts,
} from "../controllers/farmAlertController.js"
import { protect } from "../middlewares/authMiddleware.js"

const router = express.Router({ mergeParams: true })

// Protect all routes
router.use(protect)

// Validation rules
const createAlertValidation = [
  body("title").notEmpty().withMessage("Alert title is required"),
  body("description").notEmpty().withMessage("Alert description is required"),
  body("type")
    .isIn(["weather", "crop", "livestock", "equipment", "financial", "security", "other"])
    .withMessage("Invalid alert type"),
  body("category").notEmpty().withMessage("Alert category is required"),
  body("priority").isIn(["low", "medium", "high", "urgent"]).withMessage("Invalid priority level"),
  body("severity").isIn(["low", "medium", "high", "critical"]).withMessage("Invalid severity level"),
  body("source").notEmpty().withMessage("Alert source is required"),
]

const acknowledgeValidation = [body("notes").optional().isString().withMessage("Notes must be a string")]

const resolveValidation = [
  body("resolution").notEmpty().withMessage("Resolution is required"),
  body("notes").optional().isString().withMessage("Notes must be a string"),
]

const actionValidation = [
  body("action").notEmpty().withMessage("Action is required"),
  body("description").notEmpty().withMessage("Action description is required"),
  body("result").optional().isString().withMessage("Result must be a string"),
]

// Routes
router.route("/").get(getFarmAlerts).post(createAlertValidation, createFarmAlert)

router.route("/critical").get(getCriticalAlerts)

router
  .route("/:alertId")
  .get(param("alertId").isMongoId().withMessage("Invalid alert ID"), getFarmAlert)
  .put(param("alertId").isMongoId().withMessage("Invalid alert ID"), updateFarmAlert)

router
  .route("/:alertId/acknowledge")
  .post(param("alertId").isMongoId().withMessage("Invalid alert ID"), acknowledgeValidation, acknowledgeFarmAlert)

router
  .route("/:alertId/resolve")
  .post(param("alertId").isMongoId().withMessage("Invalid alert ID"), resolveValidation, resolveFarmAlert)

router
  .route("/:alertId/actions")
  .post(param("alertId").isMongoId().withMessage("Invalid alert ID"), actionValidation, addAlertAction)

export default router
