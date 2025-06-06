import mongoose from "mongoose"

const weatherAlertSchema = new mongoose.Schema(
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
        "heavy_rain",
        "drought",
        "extreme_heat",
        "frost",
        "strong_wind",
        "hail",
        "flood_risk",
        "optimal_planting",
        "optimal_harvesting",
        "irrigation_needed",
        "pest_risk",
        "disease_risk",
      ],
      required: true,
    },
    severity: {
      type: String,
      enum: ["info", "warning", "watch", "advisory", "emergency"],
      required: true,
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
    weatherData: {
      current: mongoose.Schema.Types.Mixed,
      forecast: mongoose.Schema.Types.Mixed,
      historical: mongoose.Schema.Types.Mixed,
    },
    affectedCrops: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Crop",
      },
    ],
    affectedLivestock: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Livestock",
      },
    ],
    recommendedActions: [
      {
        action: String,
        priority: {
          type: String,
          enum: ["low", "medium", "high", "critical"],
        },
        timeframe: String,
        estimatedCost: Number,
        potentialLoss: Number,
      },
    ],
    validFrom: {
      type: Date,
      required: true,
    },
    validUntil: {
      type: Date,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    acknowledged: {
      acknowledgedAt: Date,
      acknowledgedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    },
    actionsImplemented: [
      {
        action: String,
        implementedAt: Date,
        implementedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        cost: Number,
        effectiveness: {
          type: Number,
          min: 1,
          max: 5,
        },
        notes: String,
      },
    ],
    relatedTasks: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "DailyTask",
      },
    ],
    notificationsSent: [
      {
        method: {
          type: String,
          enum: ["push", "sms", "email", "voice"],
        },
        sentAt: Date,
        successful: Boolean,
        recipient: String,
      },
    ],
    source: {
      type: String,
      enum: ["weather_api", "ai_analysis", "manual", "satellite", "sensor"],
      default: "weather_api",
    },
    confidence: {
      type: Number,
      min: 0,
      max: 100,
      default: 80,
    },
    tags: [String],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
)

// Indexes
weatherAlertSchema.index({ farm: 1, isActive: 1, validUntil: 1 })
weatherAlertSchema.index({ user: 1, isActive: 1 })
weatherAlertSchema.index({ alertType: 1, severity: 1 })
weatherAlertSchema.index({ validFrom: 1, validUntil: 1 })
weatherAlertSchema.index({ createdAt: -1 })

// Virtual for time remaining
weatherAlertSchema.virtual("timeRemaining").get(function () {
  const now = new Date()
  if (this.validUntil <= now) return 0
  return Math.ceil((this.validUntil - now) / (1000 * 60 * 60)) // hours
})

// Virtual for is expired
weatherAlertSchema.virtual("isExpired").get(function () {
  return new Date() > this.validUntil
})

// Methods
weatherAlertSchema.methods.acknowledge = function (userId) {
  this.acknowledged = {
    acknowledgedAt: new Date(),
    acknowledgedBy: userId,
  }
  return this.save()
}

weatherAlertSchema.methods.implementAction = function (actionData, userId) {
  this.actionsImplemented.push({
    ...actionData,
    implementedAt: new Date(),
    implementedBy: userId,
  })
  return this.save()
}

weatherAlertSchema.methods.addNotification = function (notificationData) {
  this.notificationsSent.push({
    ...notificationData,
    sentAt: new Date(),
  })
  return this.save()
}

// Static methods
weatherAlertSchema.statics.getActiveAlerts = function (farmId) {
  return this.find({
    farm: farmId,
    isActive: true,
    validUntil: { $gte: new Date() },
  })
    .populate("affectedCrops", "name category")
    .populate("affectedLivestock", "herdName animalType")
    .sort({ severity: -1, createdAt: -1 })
}

weatherAlertSchema.statics.getAlertsByType = function (farmId, alertType) {
  return this.find({
    farm: farmId,
    alertType,
    isActive: true,
    validUntil: { $gte: new Date() },
  })
}

weatherAlertSchema.statics.expireOldAlerts = function () {
  return this.updateMany(
    {
      validUntil: { $lt: new Date() },
      isActive: true,
    },
    {
      $set: { isActive: false },
    },
  )
}

const WeatherAlert = mongoose.model("WeatherAlert", weatherAlertSchema)
export default WeatherAlert
