import mongoose from "mongoose"

const attendanceSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true,
  },
  status: {
    type: String,
    required: true,
    enum: ["present", "absent", "late", "half-day", "sick", "vacation"],
  },
  hoursWorked: {
    type: Number,
    min: 0,
    max: 24,
    default: 0,
  },
  notes: String,
  recordedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
})

const taskSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  description: String,
  priority: {
    type: String,
    enum: ["low", "medium", "high", "urgent"],
    default: "medium",
  },
  status: {
    type: String,
    enum: ["pending", "in-progress", "completed", "cancelled"],
    default: "pending",
  },
  assignedDate: {
    type: Date,
    default: Date.now,
  },
  dueDate: Date,
  completedDate: Date,
  estimatedHours: {
    type: Number,
    min: 0,
  },
  actualHours: {
    type: Number,
    min: 0,
  },
  notes: String,
  assignedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
})

const performanceReviewSchema = new mongoose.Schema({
  reviewDate: {
    type: Date,
    required: true,
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5,
  },
  strengths: [String],
  areasForImprovement: [String],
  goals: [String],
  comments: String,
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
})

const farmWorkerSchema = new mongoose.Schema(
  {
    farm: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Farm",
      required: true,
    },
    employeeId: {
      type: String,
      required: true,
      unique: true,
    },
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      required: true,
    },
    address: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: String,
    },
    dateOfBirth: Date,
    hireDate: {
      type: Date,
      required: true,
    },
    position: {
      type: String,
      required: true,
    },
    department: {
      type: String,
      required: true,
      enum: ["crops", "livestock", "maintenance", "administration", "security", "other"],
    },
    supervisor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FarmWorker",
    },
    salary: {
      type: Number,
      required: true,
      min: 0,
    },
    paymentFrequency: {
      type: String,
      enum: ["hourly", "daily", "weekly", "monthly"],
      default: "monthly",
    },
    skills: [String],
    certifications: [
      {
        name: String,
        issuedBy: String,
        issuedDate: Date,
        expiryDate: Date,
      },
    ],
    emergencyContact: {
      name: String,
      relationship: String,
      phone: String,
    },
    status: {
      type: String,
      enum: ["active", "inactive", "terminated", "on-leave"],
      default: "active",
    },
    performanceRating: {
      type: Number,
      min: 1,
      max: 5,
      default: 3,
    },
    attendance: [attendanceSchema],
    tasks: [taskSchema],
    performanceReviews: [performanceReviewSchema],
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
farmWorkerSchema.index({ farm: 1, status: 1 })
farmWorkerSchema.index({ farm: 1, department: 1 })
farmWorkerSchema.index({ employeeId: 1 })
farmWorkerSchema.index({ email: 1 })

// Virtual for full name
farmWorkerSchema.virtual("fullName").get(function () {
  return `${this.firstName} ${this.lastName}`
})

// Virtual for current age
farmWorkerSchema.virtual("age").get(function () {
  if (!this.dateOfBirth) return null
  const today = new Date()
  const birthDate = new Date(this.dateOfBirth)
  let age = today.getFullYear() - birthDate.getFullYear()
  const monthDiff = today.getMonth() - birthDate.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--
  }
  return age
})

// Virtual for years of service
farmWorkerSchema.virtual("yearsOfService").get(function () {
  const today = new Date()
  const hireDate = new Date(this.hireDate)
  return Math.floor((today - hireDate) / (365.25 * 24 * 60 * 60 * 1000))
})

// Virtual for attendance rate (last 30 days)
farmWorkerSchema.virtual("recentAttendanceRate").get(function () {
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const recentAttendance = this.attendance.filter((att) => new Date(att.date) >= thirtyDaysAgo)
  if (recentAttendance.length === 0) return 0

  const presentDays = recentAttendance.filter((att) => att.status === "present").length
  return ((presentDays / recentAttendance.length) * 100).toFixed(2)
})

// Pre-save middleware to generate employee ID if not provided
farmWorkerSchema.pre("save", async function (next) {
  if (!this.employeeId) {
    const count = await this.constructor.countDocuments({ farm: this.farm })
    this.employeeId = `EMP${String(count + 1).padStart(4, "0")}`
  }
  next()
})

const FarmWorker = mongoose.model("FarmWorker", farmWorkerSchema)
export default FarmWorker
