import express from "express"
import { body, param, query } from "express-validator"
import farmWorkerController from "../controllers/farmWorkerController.js"
import { protect } from "../middlewares/authMiddleware.js"

const router = express.Router({ mergeParams: true })

// All routes are protected
router.use(protect)

// Farm worker routes
router
  .route("/")
  .post(
    [
      body("personalInfo.firstName").notEmpty().withMessage("First name is required"),
      body("personalInfo.lastName").notEmpty().withMessage("Last name is required"),
      body("employment.position")
        .isIn([
          "farm_manager",
          "crop_specialist",
          "livestock_specialist",
          "equipment_operator",
          "general_laborer",
          "irrigation_specialist",
          "pest_control_specialist",
          "harvesting_specialist",
          "security_guard",
          "other",
        ])
        .withMessage("Invalid position"),
      body("employment.hireDate").isISO8601().withMessage("Valid hire date is required"),
      body("employment.salary.amount").isNumeric().withMessage("Salary amount must be a number"),
    ],
    farmWorkerController.createFarmWorker,
  )
  .get(
    [
      query("page").optional().isInt({ min: 1 }).withMessage("Page must be a positive integer"),
      query("limit").optional().isInt({ min: 1, max: 100 }).withMessage("Limit must be between 1 and 100"),
      query("status").optional().isIn(["active", "inactive", "suspended", "terminated"]).withMessage("Invalid status"),
    ],
    farmWorkerController.getFarmWorkers,
  )

// Performance report route
router.get(
  "/performance",
  [
    query("period").optional().isIn(["week", "month", "quarter"]).withMessage("Invalid period"),
    query("startDate").optional().isISO8601().withMessage("Invalid start date"),
    query("endDate").optional().isISO8601().withMessage("Invalid end date"),
  ],
  farmWorkerController.getPerformanceReport,
)

// Individual worker routes
router
  .route("/:workerId")
  .get([param("workerId").isMongoId().withMessage("Invalid worker ID")], farmWorkerController.getWorkerDetails)
  .put([param("workerId").isMongoId().withMessage("Invalid worker ID")], farmWorkerController.updateFarmWorker)

// Attendance routes
router.post(
  "/:workerId/attendance",
  [
    param("workerId").isMongoId().withMessage("Invalid worker ID"),
    body("date").isISO8601().withMessage("Valid date is required"),
    body("status").optional().isIn(["present", "absent", "late", "half_day", "overtime"]).withMessage("Invalid status"),
  ],
  farmWorkerController.recordAttendance,
)

// Task assignment routes
router.post(
  "/:workerId/tasks",
  [
    param("workerId").isMongoId().withMessage("Invalid worker ID"),
    body("taskId").isMongoId().withMessage("Valid task ID is required"),
  ],
  farmWorkerController.assignTask,
)

// Task completion routes
router.put(
  "/:workerId/tasks/:taskId/complete",
  [
    param("workerId").isMongoId().withMessage("Invalid worker ID"),
    param("taskId").isMongoId().withMessage("Invalid task ID"),
    body("quality").optional().isInt({ min: 1, max: 5 }).withMessage("Quality must be between 1 and 5"),
  ],
  farmWorkerController.completeTask,
)

// Performance review routes
router.post(
  "/:workerId/reviews",
  [
    param("workerId").isMongoId().withMessage("Invalid worker ID"),
    body("rating").isInt({ min: 1, max: 5 }).withMessage("Rating must be between 1 and 5"),
    body("strengths").optional().isArray().withMessage("Strengths must be an array"),
    body("improvements").optional().isArray().withMessage("Improvements must be an array"),
  ],
  farmWorkerController.addPerformanceReview,
)

// Salary calculation routes
router.get(
  "/:workerId/salary/:month/:year",
  [
    param("workerId").isMongoId().withMessage("Invalid worker ID"),
    param("month").isInt({ min: 1, max: 12 }).withMessage("Month must be between 1 and 12"),
    param("year").isInt({ min: 2020, max: 2030 }).withMessage("Invalid year"),
  ],
  farmWorkerController.calculateMonthlySalary,
)

export default router
