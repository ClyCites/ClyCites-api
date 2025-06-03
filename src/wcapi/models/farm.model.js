import mongoose from "mongoose"

const farmSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    location: {
      latitude: {
        type: Number,
        required: true,
        min: -90,
        max: 90,
      },
      longitude: {
        type: Number,
        required: true,
        min: -180,
        max: 180,
      },
      address: {
        type: String,
        required: true,
      },
      country: {
        type: String,
        required: true,
      },
      region: {
        type: String,
        required: true,
      },
    },
    size: {
      type: Number,
      required: true,
      min: 0,
    },
    crops: [
      {
        type: {
          type: String,
          required: true,
          enum: [
            "maize",
            "beans",
            "coffee",
            "banana",
            "cassava",
            "sweet_potato",
            "rice",
            "wheat",
            "tomato",
            "onion",
            "cabbage",
            "other",
          ],
        },
        variety: String,
        plantingDate: Date,
        harvestDate: Date,
        stage: {
          type: String,
          enum: ["planning", "planted", "growing", "harvesting", "harvested"],
          default: "planning",
        },
      },
    ],
    soilType: {
      type: String,
      enum: ["clay", "sandy", "loam", "silt", "peat", "chalk"],
      required: true,
    },
    irrigationSystem: {
      type: String,
      enum: ["none", "drip", "sprinkler", "flood", "furrow"],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
)

// Index for geospatial queries
farmSchema.index({ "location.latitude": 1, "location.longitude": 1 })
farmSchema.index({ userId: 1 })

export const Farm = mongoose.model("Farm", farmSchema)
