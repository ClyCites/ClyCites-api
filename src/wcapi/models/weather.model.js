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
    },
    timestamp: {
      type: Date,
      required: true,
    },
    type: {
      type: String,
      enum: ["current", "forecast", "historical"],
      required: true,
    },
    data: {
      temperature: {
        type: Number,
        required: true,
      },
      humidity: {
        type: Number,
        required: true,
        min: 0,
        max: 100,
      },
      precipitation: {
        type: Number,
        required: true,
        min: 0,
      },
      windSpeed: {
        type: Number,
        required: true,
        min: 0,
      },
      windDirection: {
        type: Number,
        required: true,
        min: 0,
        max: 360,
      },
      pressure: {
        type: Number,
        required: true,
      },
      cloudCover: {
        type: Number,
        required: true,
        min: 0,
        max: 100,
      },
      uvIndex: Number,
      visibility: Number,
      dewPoint: Number,
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
    source: {
      type: String,
      default: "open-meteo",
    },
  },
  {
    timestamps: true,
  },
)

// Indexes for efficient queries
weatherSchema.index({ "location.latitude": 1, "location.longitude": 1 })
weatherSchema.index({ timestamp: 1 })
weatherSchema.index({ type: 1 })
weatherSchema.index({ timestamp: 1, type: 1 })

export const WeatherData = mongoose.model("WeatherData", weatherSchema)
