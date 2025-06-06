import mongoose from "mongoose"

const livestockSchema = new mongoose.Schema(
  {
    farm: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Farm",
      required: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    herdName: {
      type: String,
      required: true,
      maxlength: 100,
    },
    animalType: {
      type: String,
      enum: ["cattle", "goats", "sheep", "pigs", "poultry", "rabbits", "fish", "other"],
      required: true,
    },
    breed: {
      type: String,
      required: true,
      maxlength: 100,
    },
    totalAnimals: {
      type: Number,
      required: true,
      min: 1,
    },
    ageGroups: [
      {
        ageCategory: {
          type: String,
          enum: ["young", "adult", "mature", "breeding"],
        },
        count: Number,
        averageAge: Number, // in months
      },
    ],
    genderDistribution: {
      males: {
        type: Number,
        default: 0,
      },
      females: {
        type: Number,
        default: 0,
      },
    },
    housing: {
      type: {
        type: String,
        enum: ["barn", "pasture", "coop", "pen", "pond", "cage", "free_range"],
      },
      capacity: Number,
      location: {
        coordinates: [Number], // [longitude, latitude]
        description: String,
      },
      conditions: {
        ventilation: {
          type: String,
          enum: ["poor", "fair", "good", "excellent"],
        },
        cleanliness: {
          type: String,
          enum: ["poor", "fair", "good", "excellent"],
        },
        space: {
          type: String,
          enum: ["cramped", "adequate", "spacious"],
        },
      },
    },
    feeding: {
      feedType: [String],
      feedingSchedule: [
        {
          time: String, // e.g., "06:00"
          feedType: String,
          quantity: Number,
          unit: String,
        },
      ],
      dailyFeedCost: Number,
      feedSupplier: String,
      specialDiet: String,
      waterSource: {
        type: String,
        enum: ["well", "borehole", "river", "tap", "pond"],
      },
    },
    health: {
      lastVetVisit: Date,
      veterinarian: {
        name: String,
        contact: String,
      },
      currentVaccinations: [
        {
          vaccine: String,
          dateGiven: Date,
          nextDue: Date,
          batchNumber: String,
        },
      ],
      upcomingVaccinations: [
        {
          vaccine: String,
          nextDue: Date,
          priority: {
            type: String,
            enum: ["low", "medium", "high", "critical"],
          },
        },
      ],
      healthIssues: [
        {
          issue: String,
          dateIdentified: Date,
          treatment: String,
          status: {
            type: String,
            enum: ["active", "treated", "chronic", "resolved"],
          },
          cost: Number,
        },
      ],
      mortalityRate: {
        thisMonth: Number,
        thisYear: Number,
        causes: [String],
      },
    },
    production: {
      productType: {
        type: String,
        enum: ["milk", "eggs", "meat", "wool", "honey", "fish", "manure"],
      },
      dailyProduction: {
        quantity: Number,
        unit: String,
        quality: {
          type: String,
          enum: ["poor", "fair", "good", "excellent"],
        },
      },
      monthlyProduction: [
        {
          month: String,
          year: Number,
          quantity: Number,
          unit: String,
          revenue: Number,
        },
      ],
      productionGoals: {
        daily: Number,
        monthly: Number,
        annual: Number,
      },
    },
    breeding: {
      breedingProgram: Boolean,
      breedingStock: {
        males: Number,
        females: Number,
      },
      lastBreeding: Date,
      expectedOffspring: [
        {
          expectedDate: Date,
          parentIds: [String],
          expectedCount: Number,
        },
      ],
      breedingRecords: [
        {
          date: Date,
          male: String,
          female: String,
          successful: Boolean,
          offspring: Number,
          notes: String,
        },
      ],
    },
    economics: {
      purchaseInfo: {
        date: Date,
        supplier: String,
        totalCost: Number,
        costPerAnimal: Number,
      },
      monthlyExpenses: [
        {
          month: String,
          year: Number,
          feed: Number,
          veterinary: Number,
          housing: Number,
          labor: Number,
          other: Number,
          total: Number,
        },
      ],
      monthlyIncome: [
        {
          month: String,
          year: Number,
          sales: Number,
          products: Number,
          other: Number,
          total: Number,
        },
      ],
      currentValue: Number,
      insuranceInfo: {
        provider: String,
        policyNumber: String,
        coverage: Number,
        premium: Number,
        expiryDate: Date,
      },
    },
    weatherSensitivity: {
      temperatureTolerance: {
        min: Number,
        max: Number,
        optimal: {
          min: Number,
          max: Number,
        },
      },
      humidityTolerance: {
        min: Number,
        max: Number,
      },
      rainSensitivity: {
        type: String,
        enum: ["low", "medium", "high"],
      },
      windSensitivity: {
        type: String,
        enum: ["low", "medium", "high"],
      },
    },
    records: [
      {
        date: Date,
        type: {
          type: String,
          enum: ["health", "production", "breeding", "feeding", "general"],
        },
        description: String,
        data: mongoose.Schema.Types.Mixed,
        recordedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
    tags: [String],
    notes: String,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
)

// Indexes
livestockSchema.index({ farm: 1, isActive: 1 })
livestockSchema.index({ owner: 1, animalType: 1 })
livestockSchema.index({ animalType: 1, breed: 1 })
livestockSchema.index({ "health.upcomingVaccinations.nextDue": 1 })

// Virtuals
livestockSchema.virtual("averageAge").get(function () {
  if (!this.ageGroups || this.ageGroups.length === 0) return 0
  const totalAge = this.ageGroups.reduce((sum, group) => sum + group.averageAge * group.count, 0)
  return totalAge / this.totalAnimals
})

livestockSchema.virtual("monthlyProfit").get(function () {
  const currentMonth = new Date().toISOString().slice(0, 7) // YYYY-MM
  const income = this.economics.monthlyIncome.find((m) => m.month === currentMonth)?.total || 0
  const expenses = this.economics.monthlyExpenses.find((m) => m.month === currentMonth)?.total || 0
  return income - expenses
})

livestockSchema.virtual("productionEfficiency").get(function () {
  if (!this.production.productionGoals.daily || this.production.productionGoals.daily === 0) return 0
  return (this.production.dailyProduction.quantity / this.production.productionGoals.daily) * 100
})

// Methods
livestockSchema.methods.addHealthRecord = function (healthData, userId) {
  this.records.push({
    date: new Date(),
    type: "health",
    description: healthData.description,
    data: healthData,
    recordedBy: userId,
  })
  return this.save()
}

livestockSchema.methods.addProductionRecord = function (productionData, userId) {
  this.records.push({
    date: new Date(),
    type: "production",
    description: `Production: ${productionData.quantity} ${productionData.unit}`,
    data: productionData,
    recordedBy: userId,
  })

  // Update daily production
  this.production.dailyProduction = productionData
  return this.save()
}

livestockSchema.methods.updateVaccination = function (vaccinationData) {
  // Remove from upcoming
  this.health.upcomingVaccinations = this.health.upcomingVaccinations.filter(
    (v) => v.vaccine !== vaccinationData.vaccine,
  )

  // Add to current
  this.health.currentVaccinations.push(vaccinationData)
  return this.save()
}

livestockSchema.methods.addBreedingRecord = function (breedingData, userId) {
  this.breeding.breedingRecords.push(breedingData)
  this.records.push({
    date: new Date(),
    type: "breeding",
    description: `Breeding: ${breedingData.male} x ${breedingData.female}`,
    data: breedingData,
    recordedBy: userId,
  })
  return this.save()
}

// Static methods
livestockSchema.statics.getByFarm = function (farmId) {
  return this.find({ farm: farmId, isActive: true })
}

livestockSchema.statics.getUpcomingVaccinations = function (farmId, days = 30) {
  const futureDate = new Date()
  futureDate.setDate(futureDate.getDate() + days)

  return this.find({
    farm: farmId,
    isActive: true,
    "health.upcomingVaccinations.nextDue": {
      $lte: futureDate,
    },
  })
}

livestockSchema.statics.getProductionSummary = function (farmId, startDate, endDate) {
  return this.aggregate([
    {
      $match: {
        farm: farmId,
        isActive: true,
      },
    },
    {
      $group: {
        _id: "$production.productType",
        totalAnimals: { $sum: "$totalAnimals" },
        totalDailyProduction: { $sum: "$production.dailyProduction.quantity" },
        averageProductionEfficiency: { $avg: "$productionEfficiency" },
      },
    },
  ])
}

const Livestock = mongoose.model("Livestock", livestockSchema)
export default Livestock
