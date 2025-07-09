import mongoose from "mongoose"

const farmAlertSchema = new mongoose.Schema(
  {
    farm: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Farm",
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      required: true,
      enum: ["weather", "crop", "livestock", "equipment", "financial", "security", "other"],
    },
    category: {
      type: String,
      required: true,
      trim: true,
    },
    priority: {
      type: String,
      required: true,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
    },
    severity: {
      type: String,
      required: true,
      enum: ["low", "medium", "high", "critical"],
      default: "medium",
    },
    source: {
      type: String,
      required: true,
      enum: ["system", "manual", "sensor", "weather_api", "external"],
      default: "manual",
    },
    status: {
      type: String,
      enum: ["active", "acknowledged", "resolved", "dismissed"],
      default: "active",
    },
    affectedArea: {
      type: String,
      trim: true,
    },
    recommendedActions: [
      {
        action: String,
        priority: {
          type: String,
          enum: ["low", "medium", "high", "urgent"],
          default: "medium",
        },
        completed: {
          type: Boolean,
          default: false,
        },
      },
    ],
    actionsTaken: [
      {
        action: {
          type: String,
          required: true,
        },
        description: String,
        result: String,
        takenAt: {
          type: Date,
          default: Date.now,
        },
        takenBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
      },
    ],
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    acknowledgedAt: Date,
    acknowledgedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    acknowledgmentNotes: String,
    resolvedAt: Date,
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    resolution: String,
    resolutionNotes: String,
    expiresAt: {
      type: Date,
      default: () => {
        // Default expiry: 30 days from creation
        return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      },
    },
    metadata: {
      weatherData: mongoose.Schema.Types.Mixed,
      sensorData: mongoose.Schema.Types.Mixed,
      location: {
        coordinates: [Number],
        type: {
          type: String,
          default: "Point",
        },
      },
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
farmAlertSchema.index({ farm: 1, status: 1 })
farmAlertSchema.index({ farm: 1, type: 1 })
farmAlertSchema.index({ farm: 1, priority: 1 })
farmAlertSchema.index({ farm: 1, severity: 1 })
farmAlertSchema.index({ farm: 1, expiresAt: 1 })
farmAlertSchema.index({ farm: 1, createdAt: -1 })

// Virtual for time since creation
farmAlertSchema.virtual("timeActive").get(function () {
  const now = new Date()
  const diffTime = now - this.createdAt
  const hours = Math.floor(diffTime / (1000 * 60 * 60))
  const days = Math.floor(hours / 24)

  if (days > 0) {
    return `${days} day${days > 1 ? "s" : ""}`
  } else {
    return `${hours} hour${hours > 1 ? "s" : ""}`
  }
})

// Virtual for urgency score (combination of priority and severity)
farmAlertSchema.virtual("urgencyScore").get(function () {
  const priorityScores = { low: 1, medium: 2, high: 3, urgent: 4 }
  const severityScores = { low: 1, medium: 2, high: 3, critical: 4 }

  return priorityScores[this.priority] + severityScores[this.severity]
})

// Virtual for days until expiry
farmAlertSchema.virtual("daysUntilExpiry").get(function () {
  if (!this.expiresAt) return null
  const today = new Date()
  const diffTime = this.expiresAt - today
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
})

// Middleware to auto-resolve expired alerts
farmAlertSchema.pre("find", function () {
  this.where({ expiresAt: { $gt: new Date() } })
})

farmAlertSchema.pre("findOne", function () {
  this.where({ expiresAt: { $gt: new Date() } })
})

farmAlertSchema.set("toJSON", { virtuals: true })
farmAlertSchema.set("toObject", { virtuals: true })

export default mongoose.model("FarmAlert", farmAlertSchema)
