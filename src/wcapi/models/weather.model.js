import mongoose from "mongoose"

const weatherSchema = new mongoose.Schema(
  {
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
      timezone: String,
      timezoneAbbreviation: String,
      elevation: Number,
    },
    timestamp: {
      type: Date,
      required: true,
    },
    type: {
      type: String,
      enum: ["current", "forecast", "historical", "climate"],
      required: true,
    },
    data: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    source: {
      type: String,
      default: "open-meteo",
    },
    units: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    alerts: [
      {
        type: {
          type: String,
          required: true,
        },
        severity: {
          type: String,
          enum: ["low", "medium", "high", "extreme"],
          required: true,
        },
        message: {
          type: String,
          required: true,
        },
        startTime: {
          type: Date,
          required: true,
        },
        endTime: {
          type: Date,
          required: true,
        },
      },
    ],
  },
  {
    timestamps: true,
    strict: false,
  },
)

weatherSchema.index({ "location.latitude": 1, "location.longitude": 1 })
weatherSchema.index({ timestamp: 1 })
weatherSchema.index({ type: 1 })
weatherSchema.index({ timestamp: 1, type: 1 })
weatherSchema.index({ "location.latitude": 1, "location.longitude": 1, timestamp: 1, type: 1 }, { unique: true })

export const WeatherData = mongoose.model("WeatherData", weatherSchema)
