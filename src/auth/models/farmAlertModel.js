import mongoose from "mongoose"

const farmAlertSchema = new mongoose.Schema(
  {
    farm: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Farm",
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    alertType: {
      type: String,
      enum: [
        // Weather alerts
        "weather_extreme_heat",
        "weather_frost",
        "weather_heavy_rain",
        "weather_drought",
        "weather_strong_wind",
        "weather_hail",

        // Crop alerts
        "crop_disease_detected",
        "crop_pest_infestation",
        "crop_nutrient_deficiency",
        "crop_harvest_ready",
        "crop_growth_anomaly",

        // Livestock alerts
        "livestock_health_issue",
        "livestock_vaccination_due",
        "livestock_breeding_time",
        "livestock_feed_shortage",
        "livestock_production_drop",

        // Equipment alerts
        "equipment_malfunction",
        "equipment_maintenance_due",
        "equipment_fuel_low",
        "equipment_breakdown",

        // Input alerts
        "input_low_stock",
        "input_expired",
        "input_expiring_soon",
        "input_quality_issue",

        // Worker alerts
        "worker_absent",
        "worker_performance_issue",
        "worker_safety_incident",
        "worker_training_due",

        // Financial alerts
        "cost_budget_exceeded",
        "payment_due",
        "revenue_target_missed",
        "profit_margin_low",

        // System alerts
        "data_sync_failed",
        "sensor_offline",
        "backup_failed",
        "security_breach",

        // General alerts
        "task_overdue",
        "deadline_approaching",
        "threshold_exceeded",
        "anomaly_detected",
      ],
      required: true,
    },
    severity: {
      type: String,
      enum: ["info", "low", "medium", "high", "critical", "emergency"],
      required: true,
    },
    priority: {
      type: Number,
      min: 1,
      max: 10,
      default: 5,
    },
    title: {
      type: String,
      required: true,
      maxlength: 200,
    },
    message: {
      type: String,
      required: true,
      maxlength: 1000,
    },
    description: {
      type: String,
      maxlength: 2000,
    },
    source: {
      type: String,
      enum: ["system", "sensor", "manual", "ai", "weather_api", "user_report"],
      default: "system",
    },
    sourceDetails: {
      sensorId: String,
      apiEndpoint: String,
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      systemComponent: String,
    },
    relatedEntities: {
      crops: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Crop",
        },
      ],
      livestock: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Livestock",
        },
      ],
      workers: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "FarmWorker",
        },
      ],
      inputs: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "FarmInput",
        },
      ],
      tasks: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "DailyTask",
        },
      ],
      equipment: [String], // Equipment IDs or names
    },
    data: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    thresholds: {
      current: Number,
      threshold: Number,
      unit: String,
      comparison: {
        type: String,
        enum: ["greater_than", "less_than", "equal_to", "not_equal_to"],
      },
    },
    location: {
      coordinates: [Number], // [longitude, latitude]
      description: String,
      area: String,
    },
    timeframe: {
      startTime: Date,
      endTime: Date,
      duration: Number, // in minutes
    },
    recommendedActions: [
      {
        action: {
          type: String,
          required: true,
        },
        priority: {
          type: String,
          enum: ["low", "medium", "high", "critical"],
          default: "medium",
        },
        timeframe: {
          type: String,
          enum: ["immediate", "within_hour", "within_day", "within_week", "flexible"],
          default: "within_day",
        },
        estimatedCost: Number,
        estimatedTime: Number, // in minutes
        requiredSkills: [String],
        requiredEquipment: [String],
        potentialImpact: String,
      },
    ],
    status: {
      type: String,
      enum: ["active", "acknowledged", "in_progress", "resolved", "dismissed", "expired"],
      default: "active",
    },
    acknowledgment: {
      acknowledgedAt: Date,
      acknowledgedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      notes: String,
    },
    resolution: {
      resolvedAt: Date,
      resolvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      resolution: String,
      actionsTaken: [String],
      effectiveness: {
        type: Number,
        min: 1,
        max: 5,
      },
      cost: Number,
      timeSpent: Number, // in minutes
      notes: String,
    },
    escalation: {
      escalated: {
        type: Boolean,
        default: false,
      },
      escalatedAt: Date,
      escalatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      escalatedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      reason: String,
    },
    notifications: [
      {
        method: {
          type: String,
          enum: ["email", "sms", "push", "in_app", "voice"],
        },
        recipient: String,
        sentAt: Date,
        delivered: Boolean,
        opened: Boolean,
        clicked: Boolean,
      },
    ],
    recurrence: {
      isRecurring: {
        type: Boolean,
        default: false,
      },
      frequency: {
        type: String,
        enum: ["daily", "weekly", "monthly", "seasonal", "custom"],
      },
      interval: Number,
      nextOccurrence: Date,
      endDate: Date,
    },
    metrics: {
      responseTime: Number, // minutes from creation to acknowledgment
      resolutionTime: Number, // minutes from creation to resolution
      impactScore: Number, // 1-10 scale
      costImpact: Number,
      preventedLoss: Number,
    },
    tags: [String],
    isActive: {
      type: Boolean,
      default: true,
    },
    expiresAt: Date,
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
farmAlertSchema.index({ farm: 1, status: 1, severity: -1 })
farmAlertSchema.index({ farm: 1, alertType: 1, createdAt: -1 })
farmAlertSchema.index({ user: 1, status: 1 })
farmAlertSchema.index({ severity: 1, priority: -1 })
farmAlertSchema.index({ expiresAt: 1 })
farmAlertSchema.index({ "relatedEntities.crops": 1 })
farmAlertSchema.index({ "relatedEntities.livestock": 1 })
farmAlertSchema.index({ "recurrence.nextOccurrence": 1 })

// Virtual for time since creation
farmAlertSchema.virtual("timeSinceCreation").get(function () {
  const now = new Date()
  const diffTime = now - this.createdAt
  return Math.floor(diffTime / (1000 * 60)) // minutes
})

// Virtual for is expired
farmAlertSchema.virtual("isExpired").get(function () {
  if (!this.expiresAt) return false
  return new Date() > this.expiresAt
})

// Virtual for urgency score
farmAlertSchema.virtual("urgencyScore").get(function () {
  let score = 0

  // Severity scoring
  const severityScores = {
    info: 1,
    low: 2,
    medium: 4,
    high: 7,
    critical: 9,
    emergency: 10,
  }
  score += severityScores[this.severity] * 10

  // Priority scoring
  score += this.priority * 5

  // Time factor (older alerts get higher urgency)
  const hoursOld = this.timeSinceCreation / 60
  if (hoursOld > 24) score += 20
  else if (hoursOld > 12) score += 10
  else if (hoursOld > 6) score += 5

  // Status factor
  if (this.status === "active") score += 10
  else if (this.status === "acknowledged") score += 5

  return Math.min(score, 100)
})

// Virtual for estimated impact
farmAlertSchema.virtual("estimatedImpact").get(function () {
  const impactFactors = {
    weather_extreme_heat: 8,
    weather_drought: 9,
    crop_disease_detected: 7,
    crop_pest_infestation: 6,
    livestock_health_issue: 7,
    equipment_malfunction: 5,
    input_expired: 4,
    worker_safety_incident: 8,
    cost_budget_exceeded: 6,
  }

  return impactFactors[this.alertType] || 5
})

// Methods
farmAlertSchema.methods.acknowledge = function (userId, notes = "") {
  this.status = "acknowledged"
  this.acknowledgment = {
    acknowledgedAt: new Date(),
    acknowledgedBy: userId,
    notes,
  }

  // Calculate response time
  this.metrics.responseTime = this.timeSinceCreation

  return this.save()
}

farmAlertSchema.methods.resolve = function (userId, resolutionData) {
  this.status = "resolved"
  this.resolution = {
    resolvedAt: new Date(),
    resolvedBy: userId,
    ...resolutionData,
  }

  // Calculate resolution time
  this.metrics.resolutionTime = this.timeSinceCreation

  return this.save()
}

farmAlertSchema.methods.escalate = function (userId, escalatedTo, reason) {
  this.escalation = {
    escalated: true,
    escalatedAt: new Date(),
    escalatedBy: userId,
    escalatedTo,
    reason,
  }

  // Increase priority
  this.priority = Math.min(this.priority + 2, 10)

  return this.save()
}

farmAlertSchema.methods.addNotification = function (notificationData) {
  this.notifications.push({
    ...notificationData,
    sentAt: new Date(),
  })
  return this.save()
}

farmAlertSchema.methods.snooze = function (minutes) {
  this.expiresAt = new Date(Date.now() + minutes * 60 * 1000)
  return this.save()
}

farmAlertSchema.methods.createRecurrence = function () {
  if (!this.recurrence.isRecurring) return null

  const nextAlert = new this.constructor({
    ...this.toObject(),
    _id: undefined,
    createdAt: undefined,
    updatedAt: undefined,
    status: "active",
    acknowledgment: undefined,
    resolution: undefined,
    notifications: [],
    metrics: {},
  })

  // Calculate next occurrence
  const now = new Date()
  switch (this.recurrence.frequency) {
    case "daily":
      nextAlert.createdAt = new Date(now.getTime() + 24 * 60 * 60 * 1000)
      break
    case "weekly":
      nextAlert.createdAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
      break
    case "monthly":
      nextAlert.createdAt = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate())
      break
  }

  return nextAlert
}

// Static methods
farmAlertSchema.statics.getActiveAlerts = function (farmId, options = {}) {
  const query = {
    farm: farmId,
    status: { $in: ["active", "acknowledged", "in_progress"] },
    isActive: true,
  }

  if (options.severity) {
    query.severity = options.severity
  }

  if (options.alertType) {
    query.alertType = options.alertType
  }

  return this.find(query)
    .populate("relatedEntities.crops", "name category")
    .populate("relatedEntities.livestock", "herdName animalType")
    .populate("relatedEntities.workers", "personalInfo.firstName personalInfo.lastName")
    .sort({ urgencyScore: -1, createdAt: -1 })
}

farmAlertSchema.statics.getCriticalAlerts = function (farmId) {
  return this.find({
    farm: farmId,
    severity: { $in: ["critical", "emergency"] },
    status: { $in: ["active", "acknowledged"] },
    isActive: true,
  }).sort({ priority: -1, createdAt: -1 })
}

farmAlertSchema.statics.getAlertStatistics = function (farmId, startDate, endDate) {
  return this.aggregate([
    {
      $match: {
        farm: farmId,
        createdAt: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $group: {
        _id: {
          alertType: "$alertType",
          severity: "$severity",
        },
        count: { $sum: 1 },
        avgResponseTime: { $avg: "$metrics.responseTime" },
        avgResolutionTime: { $avg: "$metrics.resolutionTime" },
        totalCostImpact: { $sum: "$metrics.costImpact" },
      },
    },
    {
      $sort: { count: -1 },
    },
  ])
}

farmAlertSchema.statics.expireOldAlerts = function () {
  return this.updateMany(
    {
      expiresAt: { $lt: new Date() },
      status: { $in: ["active", "acknowledged"] },
    },
    {
      $set: { status: "expired", isActive: false },
    },
  )
}

farmAlertSchema.statics.createRecurringAlerts = function () {
  return this.find({
    "recurrence.isRecurring": true,
    "recurrence.nextOccurrence": { $lte: new Date() },
    status: "resolved",
  }).then((alerts) => {
    const newAlerts = []
    for (const alert of alerts) {
      const newAlert = alert.createRecurrence()
      if (newAlert) {
        newAlerts.push(newAlert.save())

        // Update next occurrence
        alert.recurrence.nextOccurrence = newAlert.createdAt
        alert.save()
      }
    }
    return Promise.all(newAlerts)
  })
}

const FarmAlert = mongoose.model("FarmAlert", farmAlertSchema)
export default FarmAlert
