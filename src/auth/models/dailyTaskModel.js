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
    estimatedDuration: {
      value: Number, // in minutes
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
      requiredConditions: [String], // e.g., ["no_rain", "temperature_below_30"]
      avoidConditions: [String], // e.g., ["heavy_rain", "strong_wind"]
    },
    resources: {
      materials: [
        {
          name: String,
          quantity: Number,
          unit: String,
          estimatedCost: Number,
        },
      ],
      equipment: [String],
      laborRequired: {
        people: Number,
        skillLevel: {
          type: String,
          enum: ["basic", "intermediate", "advanced", "expert"],
          default: "basic",
        },
      },
    },
    instructions: [
      {
        step: Number,
        description: String,
        duration: Number, // minutes
        tools: [String],
        safetyNotes: String,
      },
    ],
    aiGenerated: {
      type: Boolean,
      default: false,
    },
    aiRecommendation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AIRecommendation",
    },
    status: {
      type: String,
      enum: ["pending", "in_progress", "completed", "skipped", "postponed", "cancelled"],
      default: "pending",
    },
    completion: {
      completedAt: Date,
      completedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      actualDuration: Number, // minutes
      actualCost: Number,
      notes: String,
      photos: [String], // URLs to photos
      gpsLocation: {
        latitude: Number,
        longitude: Number,
      },
      weatherAtCompletion: mongoose.Schema.Types.Mixed,
      effectiveness: {
        type: Number,
        min: 1,
        max: 5,
      },
      issues: [String],
    },
    reminders: [
      {
        reminderTime: Date,
        method: {
          type: String,
          enum: ["push", "sms", "email", "voice"],
          default: "push",
        },
        sent: {
          type: Boolean,
          default: false,
        },
        sentAt: Date,
      },
    ],
    recurrence: {
      isRecurring: {
        type: Boolean,
        default: false,
      },
      pattern: {
        type: String,
        enum: ["daily", "weekly", "monthly", "seasonal", "custom"],
      },
      interval: Number, // e.g., every 2 weeks
      endDate: Date,
      daysOfWeek: [Number], // 0-6, Sunday = 0
      customSchedule: [Date],
    },
    dependencies: [
      {
        taskId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "DailyTask",
        },
        dependencyType: {
          type: String,
          enum: ["must_complete_before", "must_start_after", "cannot_overlap"],
        },
      },
    ],
    tags: [String],
    isUrgent: {
      type: Boolean,
      default: false,
    },
    postponeCount: {
      type: Number,
      default: 0,
    },
    maxPostpones: {
      type: Number,
      default: 3,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
)

// Indexes
dailyTaskSchema.index({ farm: 1, taskDate: 1, status: 1 })
dailyTaskSchema.index({ user: 1, taskDate: 1 })
dailyTaskSchema.index({ category: 1, priority: 1 })
dailyTaskSchema.index({ status: 1, taskDate: 1 })
dailyTaskSchema.index({ crop: 1, taskDate: 1 })
dailyTaskSchema.index({ livestock: 1, taskDate: 1 })
dailyTaskSchema.index({ aiGenerated: 1, taskDate: 1 })

// Virtual for overdue status
dailyTaskSchema.virtual("isOverdue").get(function () {
  const now = new Date()
  return this.taskDate < now && this.status === "pending"
})

// Virtual for days overdue
dailyTaskSchema.virtual("daysOverdue").get(function () {
  if (!this.isOverdue) return 0
  const now = new Date()
  const diffTime = now - this.taskDate
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
})

// Virtual for urgency score
dailyTaskSchema.virtual("urgencyScore").get(function () {
  let score = 0

  // Priority scoring
  switch (this.priority) {
    case "critical":
      score += 40
      break
    case "high":
      score += 30
      break
    case "medium":
      score += 20
      break
    case "low":
      score += 10
      break
  }

  // Overdue scoring
  if (this.isOverdue) {
    score += Math.min(this.daysOverdue * 5, 30)
  }

  // Weather dependency scoring
  if (this.weatherDependent) {
    score += 10
  }

  // Urgent flag
  if (this.isUrgent) {
    score += 20
  }

  return Math.min(score, 100)
})

const DailyTask = mongoose.model("DailyTask", dailyTaskSchema)
export default DailyTask
