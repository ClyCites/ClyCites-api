import mongoose from "mongoose"

const farmWorkerSchema = new mongoose.Schema(
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
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    position: {
      type: String,
      required: true,
      trim: true,
    },
    department: {
      type: String,
      required: true,
      trim: true,
    },
    hireDate: {
      type: Date,
      required: true,
    },
    salary: {
      amount: Number,
      currency: {
        type: String,
        default: "USD",
      },
      paymentFrequency: {
        type: String,
        enum: ["hourly", "daily", "weekly", "monthly", "yearly"],
        default: "monthly",
      },
    },
    skills: [
      {
        name: String,
        level: {
          type: String,
          enum: ["beginner", "intermediate", "advanced", "expert"],
          default: "beginner",
        },
        certified: {
          type: Boolean,
          default: false,
        },
      },
    ],
    certifications: [
      {
        name: String,
        issuedBy: String,
        issuedDate: Date,
        expiryDate: Date,
        certificateNumber: String,
      },
    ],
    emergencyContact: {
      name: String,
      relationship: String,
      phone: String,
      email: String,
    },
    address: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: String,
    },
    status: {
      type: String,
      enum: ["active", "inactive", "terminated", "on_leave"],
      default: "active",
    },
    attendance: [
      {
        date: {
          type: Date,
          required: true,
        },
        status: {
          type: String,
          enum: ["present", "absent", "late", "half_day"],
          required: true,
        },
        checkIn: Date,
        checkOut: Date,
        hoursWorked: Number,
        notes: String,
        recordedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
      },
    ],
    performanceReviews: [
      {
        date: {
          type: Date,
          required: true,
        },
        period: {
          type: String,
          required: true,
        },
        rating: {
          type: Number,
          min: 1,
          max: 5,
          required: true,
        },
        strengths: [String],
        improvements: [String],
        goals: [String],
        comments: String,
        reviewedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
      },
    ],
    assignedTasks: [
      {
        task: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "DailyTask",
        },
        assignedDate: Date,
        status: {
          type: String,
          enum: ["assigned", "in_progress", "completed", "overdue"],
          default: "assigned",
        },
      },
    ],
    notes: {
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
farmWorkerSchema.index({ farm: 1, status: 1 })
farmWorkerSchema.index({ farm: 1, department: 1 })
farmWorkerSchema.index({ farm: 1, position: 1 })
farmWorkerSchema.index({ email: 1 }, { unique: true })

// Virtual for years of service
farmWorkerSchema.virtual("yearsOfService").get(function () {
  const today = new Date()
  const diffTime = today - this.hireDate
  return Math.floor(diffTime / (1000 * 60 * 60 * 24 * 365))
})

// Virtual for current month attendance rate
farmWorkerSchema.virtual("currentMonthAttendanceRate").get(function () {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const monthlyAttendance = this.attendance.filter((att) => att.date >= startOfMonth && att.date <= now)

  if (monthlyAttendance.length === 0) return 0

  const presentDays = monthlyAttendance.filter((att) => att.status === "present" || att.status === "late").length

  return ((presentDays / monthlyAttendance.length) * 100).toFixed(2)
})

// Virtual for average performance rating
farmWorkerSchema.virtual("averagePerformanceRating").get(function () {
  if (this.performanceReviews.length === 0) return 0

  const totalRating = this.performanceReviews.reduce((sum, review) => sum + review.rating, 0)
  return (totalRating / this.performanceReviews.length).toFixed(2)
})

farmWorkerSchema.set("toJSON", { virtuals: true })
farmWorkerSchema.set("toObject", { virtuals: true })

export default mongoose.model("FarmWorker", farmWorkerSchema)
