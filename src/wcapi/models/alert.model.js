import mongoose from "mongoose"

const alertSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    farmId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "Farm",
      index: true,
    },
    type: {
      type: String,
      enum: ["frost", "heat", "drought", "heavy_rain", "wind", "hail", "custom"],
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    conditions: {
      temperature: {
        min: Number,
        max: Number,
      },
      humidity: {
        min: Number,
        max: Number,
      },
      precipitation: {
        min: Number,
        max: Number,
      },
      windSpeed: {
        min: Number,
        max: Number,
      },
    },
    notifications: {
      email: {
        type: Boolean,
        default: true,
      },
      sms: {
        type: Boolean,
        default: false,
      },
      push: {
        type: Boolean,
        default: true,
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastTriggered: Date,
  },
  {
    timestamps: true,
  },
)

alertSchema.index({ userId: 1 })
alertSchema.index({ farmId: 1 })
alertSchema.index({ isActive: 1 })

export const Alert = mongoose.model("Alert", alertSchema)
