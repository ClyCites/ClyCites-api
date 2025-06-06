import mongoose from "mongoose"

const agricultureActivitySchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: [
        "planting",
        "irrigation",
        "fertilization",
        "pest_control",
        "disease_control",
        "weeding",
        "pruning",
        "harvesting",
        "soil_preparation",
        "monitoring",
        "other",
      ],
      required: true,
    },
    farm: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Farm",
      required: true,
    },
    crop: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Crop",
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    scheduledDate: Date,
    actualDate: {
      type: Date,
      default: Date.now,
    },
    duration: {
      value: Number, // in hours
      unit: {
        type: String,
        default: "hours",
      },
    },
    inputs: [
      {
        type: {
          type: String,
          enum: ["fertilizer", "pesticide", "herbicide", "seed", "water", "fuel", "labor", "equipment", "other"],
        },
        name: String,
        quantity: Number,
        unit: String,
        cost: Number,
        supplier: String,
        batchNumber: String,
        applicationRate: String, // e.g., "2kg per hectare"
      },
    ],
    equipment: [
      {
        name: String,
        type: String,
        fuelConsumption: Number,
        operatingHours: Number,
        maintenanceCost: Number,
      },
    ],
    labor: {
      workers: Number,
      hoursPerWorker: Number,
      costPerHour: Number,
      totalCost: Number,
    },
    weatherConditions: {
      temperature: Number,
      humidity: Number,
      rainfall: Number,
      windSpeed: Number,
      conditions: String, // sunny, cloudy, rainy, etc.
    },
    results: {
      success: {
        type: Boolean,
        default: true,
      },
      observations: String,
      issues: String,
      recommendations: String,
    },
    gpsCoordinates: {
      latitude: Number,
      longitude: Number,
    },
    photos: [String], // URLs to photos
    status: {
      type: String,
      enum: ["planned", "in_progress", "completed", "cancelled"],
      default: "planned",
    },
    aiRecommendations: [
      {
        type: String,
        confidence: Number, // 0-100
        source: String, // AI model that generated the recommendation
        timestamp: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
  },
)

// Indexes
agricultureActivitySchema.index({ farm: 1, actualDate: -1 })
agricultureActivitySchema.index({ crop: 1, type: 1 })
agricultureActivitySchema.index({ performedBy: 1 })
agricultureActivitySchema.index({ status: 1 })
agricultureActivitySchema.index({ type: 1, actualDate: -1 })

const AgricultureActivity = mongoose.model("AgricultureActivity", agricultureActivitySchema)
export default AgricultureActivity
