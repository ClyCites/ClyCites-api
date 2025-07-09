import mongoose from "mongoose"

const escalationSchema = new mongoose.Schema({
  escalatedAt: {
    type: Date,
    required: true,
    default: Date.now,
  },
  escalatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  previousPriority: {
    type: String,
    required: true,
  },
  newPriority: {
    type: String,
    required: true,
  },
  reason: String,
})

const commentSchema = new mongoose.Schema({
  comment: {
    type: String,
    required: true,
  },
  commentedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  commentedAt: {
    type: Date,
    default: Date.now,
  },
})

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
    },
    type: {
      type: String,
      required: true,
      enum: ["weather", "crop", "livestock", "equipment", "financial", "security", "maintenance", "other"],
    },
    priority: {
      type: String,
      required: true,
      enum: ["low", "medium", "high", "critical"],
      default: "medium",
    },
    status: {
      type: String,
      enum: ["active", "acknowledged", "in-progress", "escalated", "resolved"],
      default: "active",
    },
    severity: {
      type: String,
      enum: ["minor", "moderate", "major", "severe"],
      default: "moderate",
    },
    source: {
      type: String,
      enum: ["system", "sensor", "manual", "weather-api", "ai-analysis"],
      default: "manual",
    },
    location: {
      type: String,
      trim: true,
    },
    coordinates: {
      latitude: Number,
      longitude: Number,
    },
    affectedArea: {
      type: String,
      enum: ["entire-farm", "field", "greenhouse", "barn", "storage", "equipment", "specific-location"],
    },
    relatedEntity: {
      entityType: {
        type: String,
        enum: ["crop", "livestock", "equipment", "worker", "input", "none"],
      },
      entityId: mongoose.Schema.Types.ObjectId,
    },
    threshold: {
      parameter: String,
      value: Number,
      unit: String,
      condition: {
        type: String,
        enum: ["above", "below", "equal", "not-equal"],
      },
    },
    currentValue: {
      value: Number,
      unit: String,
      timestamp: Date,
    },
    autoResolve: {
      type: Boolean,
      default: false,
    },
    autoResolveCondition: {
      parameter: String,
      value: Number,
      unit: String,
      condition: String,
    },
    resolved: {
      type: Boolean,
      default: false,
    },
    resolvedAt: Date,
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    resolution: String,
    resolutionNotes: String,
    escalations: [escalationSchema],
    comments: [commentSchema],
    tags: [String],
    metadata: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
    },
    createdBy: {
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
farmAlertSchema.index({ farm: 1, status: 1 })
farmAlertSchema.index({ farm: 1, type: 1 })
farmAlertSchema.index({ farm: 1, priority: 1 })
farmAlertSchema.index({ farm: 1, resolved: 1 })
farmAlertSchema.index({ createdAt: -1 })
farmAlertSchema.index({ resolvedAt: 1 })

// Virtual for alert age in hours
farmAlertSchema.virtual("ageInHours").get(function () {
  const now = new Date()
  const created = new Date(this.createdAt)
  return Math.floor((now - created) / (1000 * 60 * 60))
})

// Virtual for resolution time in hours
farmAlertSchema.virtual("resolutionTimeHours").get(function () {
  if (!this.resolved || !this.resolvedAt) return null
  const resolved = new Date(this.resolvedAt)
  const created = new Date(this.createdAt)
  return Math.floor((resolved - created) / (1000 * 60 * 60))
})

// Virtual for checking if alert is overdue (based on priority)
farmAlertSchema.virtual("isOverdue").get(function () {
  if (this.resolved) return false

  const ageHours = this.ageInHours
  const thresholds = {
    critical: 2, // 2 hours
    high: 8, // 8 hours
    medium: 24, // 24 hours
    low: 72, // 72 hours
  }

  return ageHours > (thresholds[this.priority] || 24)
})

// Pre-save middleware to update lastUpdated
farmAlertSchema.pre("save", function (next) {
  this.lastUpdated = new Date()
  next()
})

// Static method to get active alerts count by priority
farmAlertSchema.statics.getActiveAlertsByPriority = function (farmId) {
  return this.aggregate([
    { $match: { farm: farmId, resolved: false } },
    { $group: { _id: "$priority", count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ])
}

// Static method to get alert trends
farmAlertSchema.statics.getAlertTrends = function (farmId, days = 30) {
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)

  return this.aggregate([
    { $match: { farm: farmId, createdAt: { $gte: startDate } } },
    {
      $group: {
        _id: {
          date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          type: "$type",
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { "_id.date": 1 } },
  ])
}

const FarmAlert = mongoose.model("FarmAlert", farmAlertSchema)
export default FarmAlert
