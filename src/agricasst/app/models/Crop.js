import mongoose from "mongoose"

const cropSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    scientificName: String,
    commonNames: [String],
    category: {
      type: String,
      enum: ["cereal", "legume", "vegetable", "fruit", "cash_crop", "forage", "spice", "medicinal"],
      required: true,
    },
    subCategory: String,
    description: String,

    growthStages: [
      {
        stage: {
          type: String,
          enum: ["germination", "seedling", "vegetative", "flowering", "fruiting", "maturity", "harvest"],
        },
        duration: Number, // days
        description: String,
        requirements: {
          temperature: { min: Number, max: Number, optimal: Number },
          humidity: { min: Number, max: Number },
          rainfall: { min: Number, max: Number },
          sunlight: Number, // hours per day
          nutrients: {
            nitrogen: String,
            phosphorus: String,
            potassium: String,
          },
        },
        activities: [String], // farming activities during this stage
        commonIssues: [String],
      },
    ],

    climaticRequirements: {
      temperature: {
        optimal: { min: Number, max: Number },
        tolerance: { min: Number, max: Number },
        critical: { min: Number, max: Number },
      },
      rainfall: {
        annual: { min: Number, max: Number },
        seasonal: String,
        distribution: String,
      },
      humidity: { min: Number, max: Number },
      soilPH: { min: Number, max: Number },
      altitude: { min: Number, max: Number },
      photoperiod: String, // day length sensitivity
      chillHours: Number, // for temperate fruits
    },

    soilRequirements: {
      type: [String], // clay, loam, sandy, etc.
      drainage: { type: String, enum: ["poor", "moderate", "good", "excellent"] },
      fertility: { type: String, enum: ["low", "moderate", "high"] },
      organicMatter: { min: Number, max: Number },
      salinity: { type: String, enum: ["sensitive", "moderate", "tolerant"] },
    },

    plantingCalendar: [
      {
        region: String,
        climate: String,
        plantingWindow: {
          start: { month: Number, day: Number },
          end: { month: Number, day: Number },
        },
        harvestWindow: {
          start: { month: Number, day: Number },
          end: { month: Number, day: Number },
        },
        notes: String,
      },
    ],

    pests: [
      {
        name: String,
        scientificName: String,
        severity: { type: String, enum: ["low", "moderate", "high"] },
        symptoms: [String],
        prevention: [String],
        treatment: [String],
        seasonality: String,
      },
    ],

    diseases: [
      {
        name: String,
        type: { type: String, enum: ["fungal", "bacterial", "viral", "nematode"] },
        severity: { type: String, enum: ["low", "moderate", "high"] },
        symptoms: [String],
        prevention: [String],
        treatment: [String],
        conditions: String, // conditions that favor the disease
      },
    ],

    marketInfo: {
      averagePrice: Number,
      priceUnit: String,
      priceRange: { min: Number, max: Number },
      demandLevel: { type: String, enum: ["low", "moderate", "high"] },
      seasonality: String,
      majorMarkets: [String],
      exportPotential: Boolean,
      valueAddition: [String],
    },

    nutritionalValue: {
      calories: Number,
      protein: Number,
      carbohydrates: Number,
      fiber: Number,
      vitamins: [String],
      minerals: [String],
    },

    cultivation: {
      seedRate: String,
      spacing: String,
      depth: String,
      irrigationFrequency: String,
      fertilizer: {
        basal: String,
        topDressing: [String],
      },
      intercropping: [String],
      rotation: [String],
    },

    yield: {
      average: Number,
      potential: Number,
      unit: String,
      factors: [String], // factors affecting yield
    },

    isActive: { type: Boolean, default: true },
    region: [String], // regions where this crop is commonly grown
    difficulty: { type: String, enum: ["beginner", "intermediate", "advanced"] },
  },
  {
    timestamps: true,
  },
)

// Indexes
cropSchema.index({ name: 1, category: 1 })
cropSchema.index({ category: 1, subCategory: 1 })
cropSchema.index({ region: 1 })
cropSchema.index({ "marketInfo.demandLevel": 1 })

// Virtual for full name
cropSchema.virtual("fullName").get(function () {
  return this.scientificName ? `${this.name} (${this.scientificName})` : this.name
})

// Method to get current growth stage based on planting date
cropSchema.methods.getCurrentGrowthStage = function (plantingDate) {
  const daysSincePlanting = Math.floor((new Date() - plantingDate) / (1000 * 60 * 60 * 24))
  let cumulativeDays = 0

  for (const stage of this.growthStages) {
    cumulativeDays += stage.duration
    if (daysSincePlanting <= cumulativeDays) {
      return stage
    }
  }

  return this.growthStages[this.growthStages.length - 1] // Return last stage if beyond all stages
}

export default mongoose.model("Crop", cropSchema)
