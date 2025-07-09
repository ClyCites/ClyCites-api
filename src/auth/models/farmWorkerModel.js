import mongoose from "mongoose"

const farmWorkerSchema = new mongoose.Schema(
  {
    farm: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Farm",
      required: true,
    },
    personalInfo: {
      firstName: {
        type: String,
        required: true,
        maxlength: 50,
      },
      lastName: {
        type: String,
        required: true,
        maxlength: 50,
      },
      dateOfBirth: Date,
      gender: {
        type: String,
        enum: ["male", "female", "other"],
      },
      nationalId: String,
      phone: String,
      email: String,
      address: {
        street: String,
        city: String,
        region: String,
        country: String,
      },
      emergencyContact: {
        name: String,
        relationship: String,
        phone: String,
      },
    },
    employment: {
      employeeId: {
        type: String,
        unique: true,
        required: true,
      },
      position: {
        type: String,
        required: true,
        enum: [
          "farm_manager",
          "crop_specialist",
          "livestock_specialist",
          "equipment_operator",
          "general_laborer",
          "irrigation_specialist",
          "pest_control_specialist",
          "harvesting_specialist",
          "security_guard",
          "other",
        ],
      },
      department: {
        type: String,
        enum: ["crops", "livestock", "equipment", "general", "management"],
        default: "general",
      },
      hireDate: {
        type: Date,
        required: true,
      },
      contractType: {
        type: String,
        enum: ["permanent", "temporary", "seasonal", "casual"],
        default: "permanent",
      },
      contractEndDate: Date,
      workSchedule: {
        type: {
          type: String,
          enum: ["full_time", "part_time", "flexible"],
          default: "full_time",
        },
        hoursPerWeek: {
          type: Number,
          default: 40,
        },
        workDays: [String], // ["monday", "tuesday", ...]
        startTime: String, // "08:00"
        endTime: String, // "17:00"
      },
      salary: {
        amount: {
          type: Number,
          required: true,
          min: 0,
        },
        currency: {
          type: String,
          default: "UGX",
        },
        paymentFrequency: {
          type: String,
          enum: ["daily", "weekly", "monthly", "per_task"],
          default: "monthly",
        },
        paymentMethod: {
          type: String,
          enum: ["cash", "bank_transfer", "mobile_money"],
          default: "cash",
        },
        bankDetails: {
          bankName: String,
          accountNumber: String,
          accountName: String,
        },
      },
      benefits: [
        {
          type: String,
          description: String,
          value: Number,
        },
      ],
    },
    skills: [
      {
        skill: String,
        level: {
          type: String,
          enum: ["beginner", "intermediate", "advanced", "expert"],
        },
        certified: Boolean,
        certificationDate: Date,
        certifyingBody: String,
      },
    ],
    performance: {
      currentRating: {
        type: Number,
        min: 1,
        max: 5,
        default: 3,
      },
      reviews: [
        {
          date: Date,
          reviewer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
          },
          rating: {
            type: Number,
            min: 1,
            max: 5,
          },
          strengths: [String],
          improvements: [String],
          goals: [String],
          comments: String,
        },
      ],
      achievements: [
        {
          title: String,
          description: String,
          date: Date,
          recognizedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
          },
        },
      ],
      disciplinaryActions: [
        {
          date: Date,
          type: {
            type: String,
            enum: ["verbal_warning", "written_warning", "suspension", "termination"],
          },
          reason: String,
          actionTaken: String,
          issuedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
          },
        },
      ],
    },
    attendance: [
      {
        date: Date,
        checkIn: Date,
        checkOut: Date,
        hoursWorked: Number,
        status: {
          type: String,
          enum: ["present", "absent", "late", "half_day", "overtime"],
          default: "present",
        },
        notes: String,
      },
    ],
    tasks: [
      {
        task: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "DailyTask",
        },
        assignedDate: Date,
        completedDate: Date,
        status: {
          type: String,
          enum: ["assigned", "in_progress", "completed", "overdue"],
          default: "assigned",
        },
        quality: {
          type: Number,
          min: 1,
          max: 5,
        },
        feedback: String,
      },
    ],
    training: [
      {
        title: String,
        description: String,
        provider: String,
        startDate: Date,
        endDate: Date,
        status: {
          type: String,
          enum: ["planned", "in_progress", "completed", "cancelled"],
        },
        cost: Number,
        certificateUrl: String,
        skills: [String],
      },
    ],
    equipment: [
      {
        equipmentName: String,
        assignedDate: Date,
        returnedDate: Date,
        condition: {
          type: String,
          enum: ["excellent", "good", "fair", "poor"],
        },
        notes: String,
      },
    ],
    healthSafety: {
      medicalInfo: {
        bloodType: String,
        allergies: [String],
        medications: [String],
        medicalConditions: [String],
      },
      safetyTraining: [
        {
          trainingType: String,
          completedDate: Date,
          expiryDate: Date,
          certificateUrl: String,
        },
      ],
      incidents: [
        {
          date: Date,
          type: {
            type: String,
            enum: ["injury", "near_miss", "property_damage", "other"],
          },
          description: String,
          severity: {
            type: String,
            enum: ["minor", "moderate", "severe", "critical"],
          },
          actionTaken: String,
          reportedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
          },
        },
      ],
    },
    status: {
      type: String,
      enum: ["active", "inactive", "suspended", "terminated"],
      default: "active",
    },
    notes: String,
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
farmWorkerSchema.index({ farm: 1, status: 1 })
farmWorkerSchema.index({ "employment.employeeId": 1 })
farmWorkerSchema.index({ "employment.position": 1 })
farmWorkerSchema.index({ "personalInfo.phone": 1 })
farmWorkerSchema.index({ "employment.hireDate": 1 })

// Virtual for full name
farmWorkerSchema.virtual("fullName").get(function () {
  return `${this.personalInfo.firstName} ${this.personalInfo.lastName}`
})

// Virtual for age
farmWorkerSchema.virtual("age").get(function () {
  if (!this.personalInfo.dateOfBirth) return null
  const today = new Date()
  const birthDate = new Date(this.personalInfo.dateOfBirth)
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
  const hireDate = new Date(this.employment.hireDate)
  return Math.floor((today - hireDate) / (365.25 * 24 * 60 * 60 * 1000))
})

// Virtual for current month attendance
farmWorkerSchema.virtual("currentMonthAttendance").get(function () {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)

  const monthAttendance = this.attendance.filter((att) => att.date >= startOfMonth && att.date <= endOfMonth)

  const totalDays = monthAttendance.length
  const presentDays = monthAttendance.filter((att) => att.status === "present").length
  const totalHours = monthAttendance.reduce((sum, att) => sum + (att.hoursWorked || 0), 0)

  return {
    totalDays,
    presentDays,
    absentDays: totalDays - presentDays,
    attendanceRate: totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0,
    totalHours,
  }
})

// Virtual for active tasks
farmWorkerSchema.virtual("activeTasks").get(function () {
  return this.tasks.filter((task) => ["assigned", "in_progress"].includes(task.status))
})

// Virtual for completed tasks this month
farmWorkerSchema.virtual("monthlyTasksCompleted").get(function () {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  return this.tasks.filter((task) => task.status === "completed" && task.completedDate >= startOfMonth).length
})

// Methods
farmWorkerSchema.methods.recordAttendance = function (attendanceData) {
  this.attendance.push(attendanceData)
  return this.save()
}

farmWorkerSchema.methods.assignTask = function (taskId) {
  this.tasks.push({
    task: taskId,
    assignedDate: new Date(),
    status: "assigned",
  })
  return this.save()
}

farmWorkerSchema.methods.completeTask = function (taskId, quality, feedback) {
  const taskIndex = this.tasks.findIndex((t) => t.task.toString() === taskId.toString())
  if (taskIndex !== -1) {
    this.tasks[taskIndex].status = "completed"
    this.tasks[taskIndex].completedDate = new Date()
    this.tasks[taskIndex].quality = quality
    this.tasks[taskIndex].feedback = feedback
  }
  return this.save()
}

farmWorkerSchema.methods.addPerformanceReview = function (reviewData) {
  this.performance.reviews.push(reviewData)
  this.performance.currentRating = reviewData.rating
  return this.save()
}

farmWorkerSchema.methods.addTraining = function (trainingData) {
  this.training.push(trainingData)
  return this.save()
}

farmWorkerSchema.methods.recordIncident = function (incidentData) {
  this.healthSafety.incidents.push(incidentData)
  return this.save()
}

farmWorkerSchema.methods.calculateMonthlySalary = function (month, year) {
  const startDate = new Date(year, month - 1, 1)
  const endDate = new Date(year, month, 0)

  const monthAttendance = this.attendance.filter((att) => att.date >= startDate && att.date <= endDate)

  const totalHours = monthAttendance.reduce((sum, att) => sum + (att.hoursWorked || 0), 0)
  const presentDays = monthAttendance.filter((att) => att.status === "present").length

  let salary = 0

  switch (this.employment.salary.paymentFrequency) {
    case "monthly":
      salary = this.employment.salary.amount
      break
    case "daily":
      salary = this.employment.salary.amount * presentDays
      break
    case "weekly":
      salary = this.employment.salary.amount * Math.ceil(presentDays / 7)
      break
    default:
      salary = this.employment.salary.amount
  }

  return {
    baseSalary: salary,
    totalHours,
    presentDays,
    benefits: this.employment.benefits.reduce((sum, benefit) => sum + (benefit.value || 0), 0),
    totalSalary: salary + this.employment.benefits.reduce((sum, benefit) => sum + (benefit.value || 0), 0),
  }
}

// Static methods
farmWorkerSchema.statics.getActiveWorkers = function (farmId) {
  return this.find({ farm: farmId, status: "active" })
}

farmWorkerSchema.statics.getWorkersByPosition = function (farmId, position) {
  return this.find({ farm: farmId, "employment.position": position, status: "active" })
}

farmWorkerSchema.statics.getPerformanceReport = function (farmId, startDate, endDate) {
  return this.aggregate([
    {
      $match: {
        farm: farmId,
        status: "active",
      },
    },
    {
      $project: {
        fullName: { $concat: ["$personalInfo.firstName", " ", "$personalInfo.lastName"] },
        position: "$employment.position",
        currentRating: "$performance.currentRating",
        tasksCompleted: {
          $size: {
            $filter: {
              input: "$tasks",
              cond: {
                $and: [
                  { $eq: ["$$this.status", "completed"] },
                  { $gte: ["$$this.completedDate", startDate] },
                  { $lte: ["$$this.completedDate", endDate] },
                ],
              },
            },
          },
        },
        averageTaskQuality: {
          $avg: {
            $map: {
              input: {
                $filter: {
                  input: "$tasks",
                  cond: {
                    $and: [
                      { $eq: ["$$this.status", "completed"] },
                      { $gte: ["$$this.completedDate", startDate] },
                      { $lte: ["$$this.completedDate", endDate] },
                    ],
                  },
                },
              },
              as: "task",
              in: "$$task.quality",
            },
          },
        },
      },
    },
  ])
}

const FarmWorker = mongoose.model("FarmWorker", farmWorkerSchema)
export default FarmWorker
