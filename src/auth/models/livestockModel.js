import mongoose from "mongoose"

const livestockSchema = new mongoose.Schema(
  {
    farm: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Farm",
      required: true,
    },
    animalType: {
      type: String,
      enum: ["cattle", "goats", "sheep", "pigs", "poultry", "rabbits", "fish", "other"],
      required: true,
    },
    breed: {
      name: String,
      supplier: String,
      origin: String,
    },
    herdName: {
      type: String,
      required: true,
      trim: true,
    },
    totalAnimals: {
      type: Number,
      required: true,
      min: 1,
    },
    animalDetails: {
      males: { type: Number, default: 0 },
      females: { type: Number, default: 0 },
      young: { type: Number, default: 0 },
      averageAge: Number, // in months
      averageWeight: Number, // in kg
    },
    housing: {
      type: {
        type: String,
        enum: ["open_grazing", "paddock", "barn", "cage", "pond", "free_range", "intensive"],
      },
      capacity: Number,
      area: {
        value: Number,
        unit: {
          type: String,
          enum: ["square_meters", "hectares", "acres"],
          default: "square_meters",
        },
      },
      roofed: Boolean,
      ventilation: {
        type: String,
        enum: ["natural", "mechanical", "none"],
        default: "natural",
      },
    },
    feeding: {
      method: {
        type: String,
        enum: ["grazing", "cut_and_carry", "mixed", "commercial_feed", "kitchen_waste"],
        required: true,
      },
      feedTypes: [
        {
          name: String,
          supplier: String,
          quantity: Number, // per day/week
          unit: String,
          cost: Number,
          nutritionalValue: String,
        },
      ],
      feedingSchedule: [
        {
          time: String, // e.g., "06:00", "12:00", "18:00"
          feedType: String,
          quantity: Number,
          unit: String,
        },
      ],
      waterSource: {
        type: String,
        enum: ["borehole", "well", "tap", "river", "pond", "tank"],
      },
      dailyWaterConsumption: Number, // liters
    },
    health: {
      vaccinationSchedule: [
        {
          vaccine: String,
          lastDate: Date,
          nextDue: Date,
          frequency: String, // e.g., "annually", "6 months"
          veterinarian: String,
          cost: Number,
        },
      ],
      commonDiseases: [String],
      lastHealthCheck: Date,
      healthStatus: {
        type: String,
        enum: ["excellent", "good", "fair", "poor", "sick"],
        default: "good",
      },
      veterinarianContact: {
        name: String,
        phone: String,
        location: String,
      },
    },
    production: {
      purpose: {
        type: String,
        enum: ["meat", "milk", "eggs", "breeding", "draft", "manure", "mixed"],
        required: true,
      },
      currentProduction: {
        milk: {
          dailyYield: Number, // liters per day
          lactatingAnimals: Number,
        },
        eggs: {
          dailyYield: Number,
          layingBirds: Number,
        },
        meat: {
          expectedSlaughterWeight: Number,
          slaughterAge: Number, // months
        },
      },
      reproductionData: {
        breedingMethod: {
          type: String,
          enum: ["natural", "artificial_insemination", "both"],
        },
        pregnantAnimals: Number,
        expectedDeliveries: [
          {
            animalId: String,
            expectedDate: Date,
            breed: String,
          },
        ],
        lastBreeding: Date,
      },
    },
    economics: {
      initialInvestment: Number,
      monthlyExpenses: {
        feed: Number,
        veterinary: Number,
        labor: Number,
        utilities: Number,
        other: Number,
      },
      monthlyIncome: {
        milk: Number,
        eggs: Number,
        meat: Number,
        breeding: Number,
        other: Number,
      },
      marketInformation: {
        milkPrice: Number, // per liter
        eggPrice: Number, // per piece/tray
        meatPrice: Number, // per kg
        lastUpdated: Date,
      },
    },
    weatherSensitivity: {
      temperatureRange: {
        min: Number, // Celsius
        max: Number,
        optimal: Number,
      },
      humidityTolerance: {
        min: Number, // percentage
        max: Number,
      },
      rainSensitivity: {
        type: String,
        enum: ["low", "medium", "high"],
        default: "medium",
      },
      seasonalNeeds: [
        {
          season: String,
          specialCare: String,
          feedAdjustments: String,
          housingNeeds: String,
        },
      ],
    },
    records: [
      {
        date: Date,
        type: {
          type: String,
          enum: ["feeding", "health", "production", "breeding", "death", "sale", "purchase", "other"],
        },
        description: String,
        quantity: Number,
        cost: Number,
        income: Number,
        notes: String,
        performedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
      },
    ],
    alerts: [
      {
        type: {
          type: String,
          enum: ["health", "feeding", "breeding", "weather", "production", "vaccination"],
        },
        message: String,
        priority: {
          type: String,
          enum: ["low", "medium", "high", "critical"],
        },
        isActive: {
          type: Boolean,
          default: true,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
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
livestockSchema.index({ farm: 1 })
livestockSchema.index({ animalType: 1 })
livestockSchema.index({ "health.nextVaccination": 1 })
livestockSchema.index({ isActive: 1 })

// Virtual for total monthly expenses
livestockSchema.virtual("totalMonthlyExpenses").get(function () {
  const expenses = this.economics.monthlyExpenses
  return Object.values(expenses).reduce((sum, expense) => sum + (expense || 0), 0)
})

// Virtual for total monthly income
livestockSchema.virtual("totalMonthlyIncome").get(function () {
  const income = this.economics.monthlyIncome
  return Object.values(income).reduce((sum, inc) => sum + (inc || 0), 0)
})

// Virtual for monthly profit
livestockSchema.virtual("monthlyProfit").get(function () {
  return this.totalMonthlyIncome - this.totalMonthlyExpenses
})

// Virtual for upcoming vaccinations
livestockSchema.virtual("upcomingVaccinations").get(function () {
  const now = new Date()
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

  return this.health.vaccinationSchedule.filter((vaccination) => {
    return vaccination.nextDue && vaccination.nextDue <= nextWeek && vaccination.nextDue >= now
  })
})

const Livestock = mongoose.model("Livestock", livestockSchema)
export default Livestock
