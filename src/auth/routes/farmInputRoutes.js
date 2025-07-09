import express from "express"
import { body, param, query } from "express-validator"
import {
  createFarmInput,
  getFarmInputs,
  getFarmInput,
  updateFarmInput,
  deleteFarmInput,
  recordInputUsage,
  getLowStockInputs,
  getExpiringInputs,
} from "../controllers/farmInputController.js"
import { protect } from "../middlewares/authMiddleware.js"

const router = express.Router({ mergeParams: true })

// Protect all routes
router.use(protect)

// Validation rules
const createInputValidation = [
  body("name").notEmpty().withMessage("Input name is required"),
  body("category")
    .isIn(["seeds", "fertilizers", "pesticides", "equipment", "feed", "medicine", "other"])
    .withMessage("Invalid category"),
  body("type").notEmpty().withMessage("Input type is required"),
  body("quantity").isNumeric().withMessage("Quantity must be a number"),
  body("unit").notEmpty().withMessage("Unit is required"),
  body("costPerUnit").isNumeric().withMessage("Cost per unit must be a number"),
  body("totalCost").isNumeric().withMessage("Total cost must be a number"),
]

const usageValidation = [
  body("quantity").isNumeric().withMessage("Quantity must be a number"),
  body("purpose").notEmpty().withMessage("Purpose is required"),
]

// Routes
router.route("/").get(getFarmInputs).post(createInputValidation, createFarmInput)

router.route("/low-stock").get(getLowStockInputs)

router
  .route("/expiring")
  .get(query("days").optional().isNumeric().withMessage("Days must be a number"), getExpiringInputs)

router
  .route("/:inputId")
  .get(param("inputId").isMongoId().withMessage("Invalid input ID"), getFarmInput)
  .put(param("inputId").isMongoId().withMessage("Invalid input ID"), updateFarmInput)
  .delete(param("inputId").isMongoId().withMessage("Invalid input ID"), deleteFarmInput)

router
  .route("/:inputId/usage")
  .post(param("inputId").isMongoId().withMessage("Invalid input ID"), usageValidation, recordInputUsage)

export default router
