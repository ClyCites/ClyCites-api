import mongoose from "mongoose"

const userFarmSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    farmName: String,
    location: {
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true },
      address: String,
      city: String,
      state: String,
      country: String,
      zipCode: String,
    },
    farmSize: {
      total: Number,
      unit: { type: String, enum: ["acres", "hectares", "square_meters"], default: "acres" },
      cultivated: Number,
      irrigated: Number,
    },
    soilType: {
      primary: String,
      secondary: String,
      pH: Number,
      organicMatter: Number,
      drainage: { type: String, enum: ["poor", "moderate", "good", "excellent"] },
    },
    crops: [
      {
        cropId: { type: mongoose.Schema.Types.ObjectId, ref: "Crop" },
        plantingDate: Date,
        expectedHarvest: Date,
        area: Number,
        variety: String,
        growthStage: String,
        notes: String,
        isActive: { type: Boolean, default: true },
      },
    ],
    infrastructure: {
      irrigationSystem: { type: String, enum: ["none", "drip", "sprinkler", "flood", "furrow"] },
      storage: Boolean,
      greenhouse: Boolean,
      machinery: [String],
    },
    preferences: {
      units: { type: String, enum: ["metric", "imperial"], default: "metric" },
      language: { type: String, default: "en" },
      notifications: {
        weather: { type: Boolean, default: true },
        irrigation: { type: Boolean, default: true },
        pests: { type: Boolean, default: true },
        market: { type: Boolean, default: false },
      },
    },
  },
  {
    timestamps: true,
  },
)

userFarmSchema.index({ userId: 1 })
userFarmSchema.index({ "location.latitude": 1, "location.longitude": 1 })

export default mongoose.model("UserFarm", userFarmSchema)
