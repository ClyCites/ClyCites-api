import mongoose from "mongoose"

const dailyTaskSchema = new mongoose.Schema(
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
    crop: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Crop",
    },
    livestock: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Livestock",
    },
    taskDate: {
      type: Date,
      required: true,
    },
    category: {
      type: String,
      enum: [
        "irrigation",
        "fertilization",
        "pest_control",
        "disease_control",
        "planting",
        "harvesting",
        "feeding",
        "health_check",
        "vaccination",
        "breeding",
        "cleaning",
        "maintenance",
        "monitoring",
        "marketing",
        "weather_response",
        "general",
      ],
      required: true,
    },
    title: {
      type: String,
      required: true,
      maxlength: 200,
    },
    description: {
      type: String,
      required: true,
      maxlength: 1000,
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "medium",
    },
    status: {
      type: String,
      enum: ["pending", "in_progress", "completed", "skipped", "postponed", "cancelled"],
      default: "pending",
    },
    estimatedDuration: {
      value: {
        type: Number,
        required: true,
      },
      unit: {
        type: String,
        enum: ["minutes", "hours", "days"],
        default: "minutes",
      },
    },
    actualDuration: {
      value: Number,
      unit: {
        type: String,
        enum: ["minutes", "hours", "days"],
        default: "minutes",
      },
    },
    weatherDependent: {
      type: Boolean,
      default: false,
    },
    weatherConditions: {
      requiredConditions: [String],
      avoidConditions: [String],
      optimalTemperature: {
        min: Number,
        max: Number,
      },
      maxWindSpeed: Number,
      maxPrecipitation: Number,
    },
    resources: [
      {
        name: String,
        quantity: Number,
        unit: String,
        estimatedCost: Number,
      },
    ],
    instructions: [
      {
        step: Number,
        description: String,
        duration: Number, // in minutes
        tools: [String],
        safetyNotes: [String],
      },
    ],
    completion: {
      completedAt: Date,
      completedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      actualResources: [
        {
          name: String,
          quantity: Number,
          unit: String,
          actualCost: Number,
        },
      ],
      notes: String,
      photos: [String],
      effectiveness: {
        type: Number,
        min: 1,
        max: 5,
      },
      challenges: [String],
    },
    reminders: [
      {
        reminderTime: Date,
        method: {
          type: String,
          enum: ["push", "sms", "email"],
        },
        sent: {
          type: Boolean,
          default: false,
        },
        sentAt: Date,
      },
    ],
    dependencies: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "DailyTask",
      },
    ],
    relatedAlerts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "WeatherAlert",
      },
    ],
    aiGenerated: {
      type: Boolean,
      default: false,
    },
    aiConfidence: {
      type: Number,
      min: 0,
      max: 100,
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
dailyTaskSchema.index({ farm: 1, taskDate: 1 })
dailyTaskSchema.index({ user: 1, status: 1 })
dailyTaskSchema.index({ category: 1, priority: 1 })
dailyTaskSchema.index({ taskDate: 1, status: 1 })
dailyTaskSchema.index({ crop: 1, taskDate: 1 })
dailyTaskSchema.index({ livestock: 1, taskDate: 1 })

// Virtual for overdue status
dailyTaskSchema.virtual("isOverdue").get(function () {
  if (this.status === "completed" || this.status === "cancelled") return false
  return new Date() > this.taskDate
})

// Virtual for days overdue
dailyTaskSchema.virtual("daysOverdue").get(function () {
  if (!this.isOverdue) return 0
  const diffTime = new Date() - this.taskDate
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
})

// Virtual for urgency score
dailyTaskSchema.virtual("urgencyScore").get(function () {
  let score = 0

  // Priority scoring
  const priorityScores = { low: 1, medium: 2, high: 3, critical: 4 }
  score += priorityScores[this.priority] * 25

  // Overdue penalty
  if (this.isOverdue) {
    score += this.daysOverdue * 10
  }

  // Weather dependency bonus
  if (this.weatherDependent) {
    score += 15
  }

  // AI confidence bonus
  if (this.aiGenerated && this.aiConfidence) {
    score += (this.aiConfidence / 100) * 10
  }

  return Math.min(score, 100)
})

// Methods
dailyTaskSchema.methods.markCompleted = function (userId, completionData = {}) {
  this.status = "completed"
  this.completion = {
    completedAt: new Date(),
    completedBy: userId,
    ...completionData,
  }
  return this.save()
}

dailyTaskSchema.methods.postpone = function (newDate, reason) {
  this.status = "postponed"
  this.taskDate = newDate
  if (reason) {
    this.completion = { notes: `Postponed: ${reason}` }
  }
  return this.save()
}

dailyTaskSchema.methods.addReminder = function (reminderData) {
  this.reminders.push(reminderData)
  return this.save()
}

// Static methods
dailyTaskSchema.statics.getTasksForDate = function (farmId, userId, date) {
  const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1)

  return this.find({
    farm: farmId,
    user: userId,
    taskDate: {
      $gte: startOfDay,
      $lt: endOfDay,
    },
  })
    .populate("crop", "name category growthStage")
    .populate("livestock", "herdName animalType totalAnimals")
    .sort({ priority: -1, urgencyScore: -1 })
}

dailyTaskSchema.statics.getOverdueTasks = function (farmId, userId) {
  return this.find({
    farm: farmId,
    user: userId,
    status: "pending",
    taskDate: { $lt: new Date() },
  })
}

dailyTaskSchema.statics.getTasksByCategory = function (farmId, userId, category, startDate, endDate) {
  return this.find({
    farm: farmId,
    user: userId,
    category,
    taskDate: {
      $gte: startDate,
      $lte: endDate,
    },
  })
}

const DailyTask = mongoose.model("DailyTask", dailyTaskSchema)
export default DailyTask
