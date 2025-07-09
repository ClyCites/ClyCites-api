import express from "express"
import { body, param, query } from "express-validator"
import farmInputController from "../controllers/farmInputController.js"
import { protect } from "../middlewares/authMiddleware.js"

const router = express.Router({ mergeParams: true })

// All routes are protected
router.use(protect)

// Farm input routes
router
  .route("/")
  .post(
    [
      body("inputType")
        .isIn([
          "seeds",
          "fertilizer",
          "pesticide",
          "herbicide",
          "fungicide",
          "feed",
          "medicine",
          "fuel",
          "equipment",
          "labor",
          "water",
          "electricity",
          "other",
        ])
        .withMessage("Invalid input type"),
      body("inputName").notEmpty().withMessage("Input name is required"),
      body("purchaseInfo.date").isISO8601().withMessage("Valid purchase date is required"),
      body("purchaseInfo.quantity").isNumeric().withMessage("Quantity must be a number"),
      body("purchaseInfo.unitCost").isNumeric().withMessage("Unit cost must be a number"),
      body("purchaseInfo.totalCost").isNumeric().withMessage("Total cost must be a number"),
    ],
    farmInputController.createFarmInput,
  )
  .get(
    [
      query("page").optional().isInt({ min: 1 }).withMessage("Page must be a positive integer"),
      query("limit").optional().isInt({ min: 1, max: 100 }).withMessage("Limit must be between 1 and 100"),
    ],
    farmInputController.getFarmInputs,
  )

// Cost analysis route
router.get(
  "/cost-analysis",
  [
    query("period").optional().isIn(["week", "month", "quarter", "year"]).withMessage("Invalid period"),
    query("startDate").optional().isISO8601().withMessage("Invalid start date"),
    query("endDate").optional().isISO8601().withMessage("Invalid end date"),
  ],
  farmInputController.getCostAnalysis,
)

// Low stock alerts route
router.get("/low-stock", farmInputController.getLowStockAlerts)

// Individual input routes
router
  .route("/:inputId")
  .get([param("inputId").isMongoId().withMessage("Invalid input ID")], farmInputController.getInputDetails)
  .put([param("inputId").isMongoId().withMessage("Invalid input ID")], farmInputController.updateFarmInput)

// Input usage routes
router.post(
  "/:inputId/usage",
  [
    param("inputId").isMongoId().withMessage("Invalid input ID"),
    body("quantity").isNumeric().withMessage("Quantity must be a number"),
    body("purpose").optional().isString().withMessage("Purpose must be a string"),
  ],
  farmInputController.addInputUsage,
)

// Stock update routes
router.put(
  "/:inputId/stock",
  [
    param("inputId").isMongoId().withMessage("Invalid input ID"),
    body("newStock").isNumeric().withMessage("New stock must be a number"),
    body("reason").optional().isString().withMessage("Reason must be a string"),
  ],
  farmInputController.updateStockLevel,
)

export default router
