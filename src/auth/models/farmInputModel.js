import mongoose from "mongoose"

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
      enum: ["seeds", "fertilizers", "pesticides", "equipment", "feed", "medicine", "other"],
    },
    type: {
      type: String,
      required: true,
      trim: true,
    },
    supplier: {
      name: String,
      contact: String,
      address: String,
    },
    purchaseDate: {
      type: Date,
      required: true,
    },
    expiryDate: {
      type: Date,
    },
    quantity: {
      initial: {
        type: Number,
        required: true,
      },
      current: {
        type: Number,
        required: true,
      },
      unit: {
        type: String,
        required: true,
      },
    },
    cost: {
      perUnit: {
        type: Number,
        required: true,
      },
      total: {
        type: Number,
        required: true,
      },
    },
    storageLocation: {
      type: String,
      trim: true,
    },
    batchNumber: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ["available", "low_stock", "depleted", "expired"],
      default: "available",
    },
    lowStockThreshold: {
      type: Number,
      default: 10,
    },
    usageHistory: [
      {
        date: {
          type: Date,
          required: true,
        },
        quantity: {
          type: Number,
          required: true,
        },
        purpose: {
          type: String,
          required: true,
        },
        notes: String,
        usedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
      },
    ],
    description: {
      type: String,
      trim: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  },
)

// Indexes
farmInputSchema.index({ farm: 1, category: 1 })
farmInputSchema.index({ farm: 1, status: 1 })
farmInputSchema.index({ farm: 1, expiryDate: 1 })
farmInputSchema.index({ farm: 1, "quantity.current": 1 })

// Middleware to update status based on quantity and expiry
farmInputSchema.pre("save", function (next) {
  // Check if expired
  if (this.expiryDate && this.expiryDate < new Date()) {
    this.status = "expired"
  }
  // Check if depleted
  else if (this.quantity.current === 0) {
    this.status = "depleted"
  }
  // Check if low stock
  else if (this.quantity.current <= this.lowStockThreshold) {
    this.status = "low_stock"
  }
  // Otherwise available
  else {
    this.status = "available"
  }

  next()
})

// Virtual for usage percentage
farmInputSchema.virtual("usagePercentage").get(function () {
  if (this.quantity.initial === 0) return 0
  return (((this.quantity.initial - this.quantity.current) / this.quantity.initial) * 100).toFixed(2)
})

// Virtual for days until expiry
farmInputSchema.virtual("daysUntilExpiry").get(function () {
  if (!this.expiryDate) return null
  const today = new Date()
  const diffTime = this.expiryDate - today
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
})

farmInputSchema.set("toJSON", { virtuals: true })
farmInputSchema.set("toObject", { virtuals: true })

export default mongoose.model("FarmInput", farmInputSchema)
