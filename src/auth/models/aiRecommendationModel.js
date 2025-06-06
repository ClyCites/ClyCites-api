import mongoose from "mongoose"

const aiRecommendationSchema = new mongoose.Schema(
  {
    farm: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Farm",
      required: true,
    },
    crop: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Crop",
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: [
        "irrigation",
        "fertilization",
        "pest_management",
        "disease_prevention",
        "harvest_timing",
        "planting_schedule",
        "weather_alert",
        "market_advisory",
        "soil_management",
        "general",
      ],
      required: true,
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "medium",
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
    actionRequired: {
      type: Boolean,
      default: false,
    },
    recommendedAction: {
      type: String,
      maxlength: 500,
    },
    timeframe: {
      type: String,
      enum: ["immediate", "within_24h", "within_week", "within_month", "seasonal"],
    },
    confidence: {
      type: Number,
      min: 0,
      max: 100,
      required: true,
    },
    dataSource: {
      weather: Boolean,
      soilData: Boolean,
      cropStage: Boolean,
      historicalData: Boolean,
      marketData: Boolean,
      satelliteImagery: Boolean,
    },
    weatherContext: {
      currentConditions: mongoose.Schema.Types.Mixed,
      forecast: mongoose.Schema.Types.Mixed,
      alerts: [String],
    },
    economicImpact: {
      potentialLoss: Number, // in currency
      potentialGain: Number,
      costOfAction: Number,
      roi: Number, // return on investment percentage
    },
    status: {
      type: String,
      enum: ["active", "acknowledged", "implemented", "dismissed", "expired"],
      default: "active",
    },
    userFeedback: {
      rating: {
        type: Number,
        min: 1,
        max: 5,
      },
      helpful: Boolean,
      comments: String,
      implementationResult: String,
    },
    aiModel: {
      name: String,
      version: String,
      parameters: mongoose.Schema.Types.Mixed,
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    },
    relatedActivities: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "AgricultureActivity",
      },
    ],
  },
  {
    timestamps: true,
  },
)

// Indexes
aiRecommendationSchema.index({ farm: 1, status: 1, createdAt: -1 })
aiRecommendationSchema.index({ user: 1, status: 1 })
aiRecommendationSchema.index({ type: 1, priority: 1 })
aiRecommendationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })
aiRecommendationSchema.index({ crop: 1, type: 1 })

const AIRecommendation = mongoose.model("AIRecommendation", aiRecommendationSchema)
export default AIRecommendation
