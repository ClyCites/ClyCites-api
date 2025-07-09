import express from "express"
import {
  getFarmWorkers,
  addFarmWorker,
  getFarmWorker,
  updateFarmWorker,
  recordAttendance,
  assignTask,
  updateTaskStatus,
  getWorkerAnalytics,
  deleteFarmWorker,
} from "../controllers/farmWorkerController.js"
import { protect } from "../middlewares/authMiddleware.js"

const router = express.Router()

// Farm-specific routes
router.route("/farms/:farmId/workers").get(protect, getFarmWorkers).post(protect, addFarmWorker)

router.get("/farms/:farmId/workers/analytics", protect, getWorkerAnalytics)

// Individual worker routes
router
  .route("/workers/:workerId")
  .get(protect, getFarmWorker)
  .put(protect, updateFarmWorker)
  .delete(protect, deleteFarmWorker)

router.post("/workers/:workerId/attendance", protect, recordAttendance)
router.post("/workers/:workerId/tasks", protect, assignTask)
router.put("/workers/:workerId/tasks/:taskId", protect, updateTaskStatus)

export default router
