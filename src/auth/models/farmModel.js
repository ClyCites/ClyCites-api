import mongoose from "mongoose"

const farmSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Farm name is required"],
      trim: true,
      maxlength: [100, "Farm name cannot exceed 100 characters"],
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
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
        maxlength: [200, "Address cannot exceed 200 characters"],
      },
      region: String,
      country: String,
      elevation: Number,
    },
    size: {
      value: {
        type: Number,
        required: true,
        min: 0,
      },
      unit: {
        type: String,
        enum: ["hectares", "acres", "square_meters"],
        default: "hectares",
      },
    },
    soilType: {
      type: String,
      enum: ["clay", "sandy", "loam", "silt", "peat", "chalk", "mixed"],
    },
    soilPH: {
      type: Number,
      min: 0,
      max: 14,
    },
    irrigationSystem: {
      type: String,
      enum: ["drip", "sprinkler", "flood", "furrow", "center_pivot", "none"],
      default: "none",
    },
    farmType: {
      type: String,
      enum: ["crop", "livestock", "mixed", "aquaculture", "poultry", "dairy"],
      required: true,
    },
    certifications: [
      {
        type: {
          type: String,
          enum: ["organic", "fair_trade", "rainforest_alliance", "global_gap", "other"],
        },
        name: String,
        issuedBy: String,
        validUntil: Date,
        certificateNumber: String,
      },
    ],
    weatherStationId: String, // Link to weather monitoring station
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
farmSchema.index({ owner: 1 })
farmSchema.index({ organization: 1 })
farmSchema.index({ "location.latitude": 1, "location.longitude": 1 })
farmSchema.index({ farmType: 1 })
farmSchema.index({ isActive: 1 })

// Virtual for farm area in different units
farmSchema.virtual("areaInHectares").get(function () {
  if (this.size.unit === "hectares") return this.size.value
  if (this.size.unit === "acres") return this.size.value * 0.404686
  if (this.size.unit === "square_meters") return this.size.value / 10000
  return this.size.value
})

const Farm = mongoose.model("Farm", farmSchema)
export default Farm
