import express from "express"
import { body, param, query } from "express-validator"
import farmAlertController from "../controllers/farmAlertController.js"
import { protect } from "../middlewares/authMiddleware.js"

const router = express.Router({ mergeParams: true })

// All routes are protected
router.use(protect)

// Farm alert routes
router
  .route("/")
  .post(
    [
      body("alertType").notEmpty().withMessage("Alert type is required"),
      body("severity").isIn(["info", "low", "medium", "high", "critical", "emergency"]).withMessage("Invalid severity"),
      body("title").notEmpty().withMessage("Title is required"),
      body("message").notEmpty().withMessage("Message is required"),
    ],
    farmAlertController.createFarmAlert,
  )
  .get(
    [
      query("page").optional().isInt({ min: 1 }).withMessage("Page must be a positive integer"),
      query("limit").optional().isInt({ min: 1, max: 100 }).withMessage("Limit must be between 1 and 100"),
      query("severity")
        .optional()
        .isIn(["info", "low", "medium", "high", "critical", "emergency"])
        .withMessage("Invalid severity"),
      query("status")
        .optional()
        .isIn(["active", "acknowledged", "in_progress", "resolved", "dismissed", "expired"])
        .withMessage("Invalid status"),
    ],
    farmAlertController.getFarmAlerts,
  )

// Critical alerts route
router.get("/critical", farmAlertController.getCriticalAlerts)

// Alert statistics route
router.get(
  "/statistics",
  [query("period").optional().isIn(["week", "month", "quarter", "year"]).withMessage("Invalid period")],
  farmAlertController.getAlertStatistics,
)

// Individual alert routes (moved to separate router to avoid conflicts)
const alertRouter = express.Router()
alertRouter.use(protect)

alertRouter
  .route("/:alertId")
  .get([param("alertId").isMongoId().withMessage("Invalid alert ID")], farmAlertController.getAlertDetails)

// Alert action routes
alertRouter.put(
  "/:alertId/acknowledge",
  [
    param("alertId").isMongoId().withMessage("Invalid alert ID"),
    body("notes").optional().isString().withMessage("Notes must be a string"),
  ],
  farmAlertController.acknowledgeAlert,
)

alertRouter.put(
  "/:alertId/resolve",
  [
    param("alertId").isMongoId().withMessage("Invalid alert ID"),
    body("resolution").notEmpty().withMessage("Resolution is required"),
    body("effectiveness").optional().isInt({ min: 1, max: 5 }).withMessage("Effectiveness must be between 1 and 5"),
  ],
  farmAlertController.resolveAlert,
)

alertRouter.put(
  "/:alertId/escalate",
  [
    param("alertId").isMongoId().withMessage("Invalid alert ID"),
    body("escalatedTo").isMongoId().withMessage("Valid user ID is required"),
    body("reason").notEmpty().withMessage("Escalation reason is required"),
  ],
  farmAlertController.escalateAlert,
)

alertRouter.put(
  "/:alertId/snooze",
  [
    param("alertId").isMongoId().withMessage("Invalid alert ID"),
    body("minutes").isInt({ min: 1, max: 1440 }).withMessage("Minutes must be between 1 and 1440"),
  ],
  farmAlertController.snoozeAlert,
)

alertRouter.put(
  "/:alertId/dismiss",
  [
    param("alertId").isMongoId().withMessage("Invalid alert ID"),
    body("reason").optional().isString().withMessage("Reason must be a string"),
  ],
  farmAlertController.dismissAlert,
)

export { router as farmAlertRoutes, alertRouter }
