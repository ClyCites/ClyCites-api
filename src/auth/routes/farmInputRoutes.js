import express from "express"
import {
  getFarmInputs,
  addFarmInput,
  getFarmInput,
  updateFarmInput,
  recordInputUsage,
  getInputAnalytics,
  deleteFarmInput,
} from "../controllers/farmInputController.js"
import { protect } from "../middlewares/authMiddleware.js"

const router = express.Router()

// Farm-specific routes
router.route("/farms/:farmId/inputs").get(protect, getFarmInputs).post(protect, addFarmInput)

router.get("/farms/:farmId/inputs/analytics", protect, getInputAnalytics)

// Individual input routes
router
  .route("/inputs/:inputId")
  .get(protect, getFarmInput)
  .put(protect, updateFarmInput)
  .delete(protect, deleteFarmInput)

router.post("/inputs/:inputId/usage", protect, recordInputUsage)

export default router
