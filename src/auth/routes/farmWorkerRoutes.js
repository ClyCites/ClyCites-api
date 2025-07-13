import express from "express"
import { body, param, query } from "express-validator"
import {
  createFarmWorker,
  getFarmWorkers,
  getFarmWorker,
  updateFarmWorker,
  deleteFarmWorker,
  recordAttendance,
  addPerformanceReview,
  getAttendanceReport,
} from "../controllers/farmWorkerController.js"
import { protect } from "../middlewares/authMiddleware.js"

const router = express.Router({ mergeParams: true })

// Protect all routes
router.use(protect)

// Validation rules
const createWorkerValidation = [
  body("name").notEmpty().withMessage("Worker name is required"),
  body("email").isEmail().withMessage("Valid email is required"),
  body("phone").notEmpty().withMessage("Phone number is required"),
  body("position").notEmpty().withMessage("Position is required"),
  body("department").notEmpty().withMessage("Department is required"),
  body("hireDate").isISO8601().withMessage("Valid hire date is required"),
  body("salary").optional().isNumeric().withMessage("Salary must be a number"),
]

const attendanceValidation = [
  body("date").isISO8601().withMessage("Valid date is required"),
  body("status").isIn(["present", "absent", "late", "half_day"]).withMessage("Invalid attendance status"),
  body("hoursWorked").optional().isNumeric().withMessage("Hours worked must be a number"),
]

const performanceValidation = [
  body("period").notEmpty().withMessage("Review period is required"),
  body("rating").isNumeric().isFloat({ min: 1, max: 5 }).withMessage("Rating must be between 1 and 5"),
  body("strengths").isArray().withMessage("Strengths must be an array"),
  body("improvements").isArray().withMessage("Improvements must be an array"),
]

// Routes
router.route("/").get(getFarmWorkers).post(createWorkerValidation, createFarmWorker)

router
  .route("/:workerId")
  .get(param("workerId").isMongoId().withMessage("Invalid worker ID"), getFarmWorker)
  .put(param("workerId").isMongoId().withMessage("Invalid worker ID"), updateFarmWorker)
  .delete(param("workerId").isMongoId().withMessage("Invalid worker ID"), deleteFarmWorker)

router
  .route("/:workerId/attendance")
  .post(param("workerId").isMongoId().withMessage("Invalid worker ID"), attendanceValidation, recordAttendance)

router
  .route("/:workerId/performance")
  .post(param("workerId").isMongoId().withMessage("Invalid worker ID"), performanceValidation, addPerformanceReview)

router
  .route("/:workerId/attendance-report")
  .get(
    param("workerId").isMongoId().withMessage("Invalid worker ID"),
    query("startDate").optional().isISO8601().withMessage("Invalid start date"),
    query("endDate").optional().isISO8601().withMessage("Invalid end date"),
    getAttendanceReport,
  )

export default router
