import express from "express"
import {
  getFarmAlerts,
  createFarmAlert,
  getFarmAlert,
  updateFarmAlert,
  resolveFarmAlert,
  escalateFarmAlert,
  addAlertComment,
  getAlertAnalytics,
  deleteFarmAlert,
} from "../controllers/farmAlertController.js"
import { protect } from "../middlewares/authMiddleware.js"

const router = express.Router()

// Farm-specific routes
router.route("/farms/:farmId/alerts").get(protect, getFarmAlerts).post(protect, createFarmAlert)

router.get("/farms/:farmId/alerts/analytics", protect, getAlertAnalytics)

// Individual alert routes
router
  .route("/alerts/:alertId")
  .get(protect, getFarmAlert)
  .put(protect, updateFarmAlert)
  .delete(protect, deleteFarmAlert)

router.post("/alerts/:alertId/resolve", protect, resolveFarmAlert)
router.post("/alerts/:alertId/escalate", protect, escalateFarmAlert)
router.post("/alerts/:alertId/comments", protect, addAlertComment)

export default router
