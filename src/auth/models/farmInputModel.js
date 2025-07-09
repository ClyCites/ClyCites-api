import mongoose from "mongoose"

const usageHistorySchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true,
    default: Date.now,
  },
  amount: {
    type: Number,
    required: true,
    min: 0,
  },
  purpose: {
    type: String,
    required: true,
  },
  notes: String,
  recordedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
})

const farmInputSchema = new mongoose.Schema(
  {
    farm: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Farm",
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      enum: ["seeds", "fertilizers", "pesticides", "tools", "equipment", "feed", "medicine", "other"],
    },
    brand: {
      type: String,
      trim: true,
    },
    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
    },
    purchaseDate: {
      type: Date,
      required: true,
    },
    expiryDate: Date,
    batchNumber: String,
    quantity: {
      type: Number,
      required: true,
      min: 0,
    },
    unit: {
      type: String,
      required: true,
      enum: ["kg", "g", "l", "ml", "pieces", "bags", "bottles", "boxes"],
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
    currentStock: {
      type: Number,
      required: true,
      min: 0,
    },
    minimumStock: {
      type: Number,
      required: true,
      min: 0,
      default: 10,
    },
    status: {
      type: String,
      enum: ["active", "expired", "depleted", "recalled"],
      default: "active",
    },
    storageLocation: String,
    storageConditions: String,
    usageHistory: [usageHistorySchema],
    notes: String,
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
)

// Indexes for better query performance
farmInputSchema.index({ farm: 1, category: 1 })
farmInputSchema.index({ farm: 1, status: 1 })
farmInputSchema.index({ expiryDate: 1 })
farmInputSchema.index({ currentStock: 1, minimumStock: 1 })

// Virtual for checking if stock is low
farmInputSchema.virtual("isLowStock").get(function () {
  return this.currentStock < this.minimumStock
})

// Virtual for checking if expired
farmInputSchema.virtual("isExpired").get(function () {
  return this.expiryDate && new Date(this.expiryDate) < new Date()
})

// Virtual for days until expiry
farmInputSchema.virtual("daysUntilExpiry").get(function () {
  if (!this.expiryDate) return null
  const today = new Date()
  const expiry = new Date(this.expiryDate)
  const diffTime = expiry - today
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
})

// Pre-save middleware to update status based on conditions
farmInputSchema.pre("save", function (next) {
  if (this.currentStock === 0) {
    this.status = "depleted"
  } else if (this.expiryDate && new Date(this.expiryDate) < new Date()) {
    this.status = "expired"
  } else if (this.status === "depleted" || this.status === "expired") {
    this.status = "active"
  }
  next()
})

const FarmInput = mongoose.model("FarmInput", farmInputSchema)
export default FarmInput
