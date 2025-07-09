import mongoose from "mongoose"

const farmInputSchema = new mongoose.Schema(
  {
    farm: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Farm",
      required: true,
    },
    crop: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Crop",
    },
    livestock: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Livestock",
    },
    inputType: {
      type: String,
      enum: [
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
      ],
      required: true,
    },
    inputName: {
      type: String,
      required: true,
      maxlength: 200,
    },
    brand: String,
    supplier: {
      name: String,
      contact: String,
      address: String,
    },
    purchaseInfo: {
      date: {
        type: Date,
        required: true,
      },
      quantity: {
        type: Number,
        required: true,
        min: 0,
      },
      unit: {
        type: String,
        required: true,
        enum: ["kg", "liters", "bags", "bottles", "pieces", "hours", "days", "tons", "gallons"],
      },
      unitCost: {
        type: Number,
        required: true,
        min: 0,
      },
      totalCost: {
        type: Number,
        required: true,
        min: 0,
      },
      currency: {
        type: String,
        default: "UGX",
      },
      invoiceNumber: String,
      receiptUrl: String,
    },
    usage: [
      {
        date: {
          type: Date,
          required: true,
        },
        quantity: {
          type: Number,
          required: true,
          min: 0,
        },
        purpose: String,
        appliedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        applicationMethod: String,
        weatherConditions: {
          temperature: Number,
          humidity: Number,
          windSpeed: Number,
          precipitation: Number,
        },
        effectiveness: {
          type: Number,
          min: 1,
          max: 5,
        },
        notes: String,
      },
    ],
    currentStock: {
      type: Number,
      required: true,
      min: 0,
    },
    minimumStock: {
      type: Number,
      default: 0,
      min: 0,
    },
    expiryDate: Date,
    storageLocation: String,
    storageConditions: {
      temperature: {
        min: Number,
        max: Number,
      },
      humidity: {
        min: Number,
        max: Number,
      },
      specialRequirements: [String],
    },
    safetyInfo: {
      hazardLevel: {
        type: String,
        enum: ["low", "medium", "high", "extreme"],
        default: "low",
      },
      safetyPrecautions: [String],
      firstAid: [String],
      disposalInstructions: String,
    },
    qualityMetrics: {
      purity: Number,
      concentration: Number,
      ph: Number,
      moisture: Number,
      otherSpecs: mongoose.Schema.Types.Mixed,
    },
    certifications: [
      {
        type: String,
        issuer: String,
        validUntil: Date,
        certificateNumber: String,
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
    tags: [String],
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
)

// Indexes
farmInputSchema.index({ farm: 1, inputType: 1 })
farmInputSchema.index({ farm: 1, currentStock: 1 })
farmInputSchema.index({ expiryDate: 1 })
farmInputSchema.index({ "purchaseInfo.date": -1 })
farmInputSchema.index({ crop: 1, inputType: 1 })
farmInputSchema.index({ livestock: 1, inputType: 1 })

// Virtual for total usage
farmInputSchema.virtual("totalUsed").get(function () {
  return this.usage.reduce((sum, use) => sum + use.quantity, 0)
})

// Virtual for remaining stock percentage
farmInputSchema.virtual("stockPercentage").get(function () {
  const totalPurchased = this.purchaseInfo.quantity
  return totalPurchased > 0 ? Math.round((this.currentStock / totalPurchased) * 100) : 0
})

// Virtual for cost per unit used
farmInputSchema.virtual("costPerUnitUsed").get(function () {
  const totalUsed = this.totalUsed
  return totalUsed > 0 ? this.purchaseInfo.totalCost / totalUsed : 0
})

// Virtual for days until expiry
farmInputSchema.virtual("daysUntilExpiry").get(function () {
  if (!this.expiryDate) return null
  const now = new Date()
  const diffTime = this.expiryDate - now
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
})

// Virtual for low stock alert
farmInputSchema.virtual("isLowStock").get(function () {
  return this.currentStock <= this.minimumStock
})

// Virtual for expired status
farmInputSchema.virtual("isExpired").get(function () {
  if (!this.expiryDate) return false
  return new Date() > this.expiryDate
})

// Methods
farmInputSchema.methods.addUsage = function (usageData) {
  this.usage.push(usageData)
  this.currentStock -= usageData.quantity
  if (this.currentStock < 0) this.currentStock = 0
  return this.save()
}

farmInputSchema.methods.updateStock = function (newStock, reason = "manual_adjustment") {
  const oldStock = this.currentStock
  this.currentStock = newStock

  // Add usage record for stock adjustment
  if (oldStock !== newStock) {
    this.usage.push({
      date: new Date(),
      quantity: oldStock - newStock,
      purpose: reason,
      notes: `Stock adjusted from ${oldStock} to ${newStock}`,
    })
  }

  return this.save()
}

farmInputSchema.methods.checkAlerts = function () {
  const alerts = []

  if (this.isLowStock) {
    alerts.push({
      type: "low_stock",
      message: `${this.inputName} stock is low (${this.currentStock} ${this.purchaseInfo.unit} remaining)`,
      priority: "medium",
    })
  }

  if (this.isExpired) {
    alerts.push({
      type: "expired",
      message: `${this.inputName} has expired`,
      priority: "high",
    })
  } else if (this.daysUntilExpiry && this.daysUntilExpiry <= 30) {
    alerts.push({
      type: "expiring_soon",
      message: `${this.inputName} expires in ${this.daysUntilExpiry} days`,
      priority: "medium",
    })
  }

  return alerts
}

// Static methods
farmInputSchema.statics.getLowStockItems = function (farmId) {
  return this.find({
    farm: farmId,
    isActive: true,
    $expr: { $lte: ["$currentStock", "$minimumStock"] },
  })
}

farmInputSchema.statics.getExpiringItems = function (farmId, days = 30) {
  const futureDate = new Date()
  futureDate.setDate(futureDate.getDate() + days)

  return this.find({
    farm: farmId,
    isActive: true,
    expiryDate: {
      $lte: futureDate,
      $gte: new Date(),
    },
  })
}

farmInputSchema.statics.getCostAnalysis = function (farmId, startDate, endDate) {
  return this.aggregate([
    {
      $match: {
        farm: farmId,
        "purchaseInfo.date": {
          $gte: startDate,
          $lte: endDate,
        },
      },
    },
    {
      $group: {
        _id: "$inputType",
        totalCost: { $sum: "$purchaseInfo.totalCost" },
        totalQuantity: { $sum: "$purchaseInfo.quantity" },
        averageCost: { $avg: "$purchaseInfo.unitCost" },
        count: { $sum: 1 },
      },
    },
    {
      $sort: { totalCost: -1 },
    },
  ])
}

const FarmInput = mongoose.model("FarmInput", farmInputSchema)
export default FarmInput
