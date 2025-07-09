import express from "express"
import { param, query } from "express-validator"
import {
  getFarmDashboard,
  getSmartActions,
  generateFarmReport,
  getFarmHealth,
} from "../controllers/smartFarmController.js"
import { protect } from "../middlewares/authMiddleware.js"

const router = express.Router({ mergeParams: true })

// Protect all routes
router.use(protect)

// Routes
router.route("/dashboard").get(param("farmId").isMongoId().withMessage("Invalid farm ID"), getFarmDashboard)

router.route("/smart-actions").get(param("farmId").isMongoId().withMessage("Invalid farm ID"), getSmartActions)

router
  .route("/report")
  .get(
    param("farmId").isMongoId().withMessage("Invalid farm ID"),
    query("period").optional().isIn(["week", "month", "quarter", "year"]),
    generateFarmReport,
  )

router.route("/health").get(param("farmId").isMongoId().withMessage("Invalid farm ID"), getFarmHealth)

export default router
