import mongoose from "mongoose"

const weatherSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    location: {
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true },
      city: String,
      country: String,
      region: String,
      timezone: String,
    },
    current: {
      temperature: Number,
      feelsLike: Number,
      humidity: Number,
      pressure: Number,
      windSpeed: Number,
      windDirection: Number,
      visibility: Number,
      uvIndex: Number,
      cloudCover: Number,
      description: String,
      icon: String,
      sunrise: Date,
      sunset: Date,
    },
    forecast: [
      {
        date: Date,
        temperature: {
          min: Number,
          max: Number,
          morning: Number,
          day: Number,
          evening: Number,
          night: Number,
        },
        humidity: Number,
        precipitation: {
          probability: Number,
          amount: Number,
          type: { type: String, enum: ["rain", "snow", "sleet"] },
        },
        windSpeed: Number,
        windDirection: Number,
        pressure: Number,
        uvIndex: Number,
        description: String,
        icon: String,
      },
    ],
    agriculturalMetrics: {
      growingDegreeDays: Number,
      soilTemperature: {
        surface: Number,
        depth10cm: Number,
        depth50cm: Number,
      },
      evapotranspiration: {
        reference: Number,
        crop: Number,
      },
      chillHours: Number,
      heatStress: {
        level: { type: String, enum: ["low", "moderate", "high", "extreme"] },
        duration: Number,
        consecutiveDays: Number,
      },
      moistureIndex: Number,
      photoperiod: Number,
    },
    alerts: [
      {
        type: {
          type: String,
          enum: ["frost", "drought", "flood", "storm", "heatwave", "wind", "hail"],
        },
        severity: {
          type: String,
          enum: ["low", "moderate", "high", "critical"],
        },
        title: String,
        message: String,
        recommendations: [String],
        startTime: Date,
        endTime: Date,
        isActive: { type: Boolean, default: true },
      },
    ],
    dataQuality: {
      accuracy: Number,
      lastUpdated: Date,
      source: { type: String, default: "openweathermap" },
      apiCalls: Number,
    },
  },
  {
    timestamps: true,
  },
)

// Indexes for performance
weatherSchema.index({ userId: 1, "location.latitude": 1, "location.longitude": 1 })
weatherSchema.index({ "location.latitude": 1, "location.longitude": 1 })
weatherSchema.index({ lastUpdated: 1 })
weatherSchema.index({ "alerts.isActive": 1, "alerts.endTime": 1 })

// Virtual for location string
weatherSchema.virtual("locationString").get(function () {
  return `${this.location.city}, ${this.location.country}`
})

// Method to check if data is stale
weatherSchema.methods.isStale = function (maxAgeMinutes = 30) {
  const now = new Date()
  const dataAge = now - this.dataQuality.lastUpdated
  return dataAge > maxAgeMinutes * 60 * 1000
}

export default mongoose.model("Weather", weatherSchema)
