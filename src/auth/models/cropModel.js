import mongoose from "mongoose"

const cropSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Crop name is required"],
      trim: true,
    },
    scientificName: String,
    category: {
      type: String,
      enum: ["cereals", "legumes", "vegetables", "fruits", "cash_crops", "fodder", "spices", "other"],
      required: true,
    },
    variety: String,
    farm: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Farm",
      required: true,
    },
    field: {
      name: String,
      area: {
        value: Number,
        unit: {
          type: String,
          enum: ["hectares", "acres", "square_meters"],
          default: "hectares",
        },
      },
      coordinates: [
        {
          latitude: Number,
          longitude: Number,
        },
      ],
    },
    season: {
      type: String,
      enum: ["spring", "summer", "autumn", "winter", "dry", "wet"],
    },
    plantingDate: {
      type: Date,
      required: true,
    },
    expectedHarvestDate: Date,
    actualHarvestDate: Date,
    growthStage: {
      type: String,
      enum: [
        "seed",
        "germination",
        "seedling",
        "vegetative",
        "flowering",
        "fruiting",
        "maturity",
        "harvest",
        "post_harvest",
      ],
      default: "seed",
    },
    plantingMethod: {
      type: String,
      enum: ["direct_seeding", "transplanting", "broadcasting", "drilling"],
    },
    seedSource: {
      supplier: String,
      variety: String,
      batchNumber: String,
      quantity: Number,
      cost: Number,
    },
    expectedYield: {
      quantity: Number,
      unit: String, // kg, tons, bags, etc.
    },
    actualYield: {
      quantity: Number,
      unit: String,
      qualityGrade: {
        type: String,
        enum: ["A", "B", "C", "reject"],
      },
    },
    marketPrice: {
      pricePerUnit: Number,
      currency: {
        type: String,
        default: "UGX",
      },
      marketDate: Date,
    },
    status: {
      type: String,
      enum: ["planned", "planted", "growing", "harvested", "sold", "failed"],
      default: "planned",
    },
    notes: String,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
)

// Indexes
cropSchema.index({ farm: 1 })
cropSchema.index({ plantingDate: 1 })
cropSchema.index({ category: 1 })
cropSchema.index({ status: 1 })
cropSchema.index({ growthStage: 1 })

// Virtual for crop age in days
cropSchema.virtual("ageInDays").get(function () {
  if (!this.plantingDate) return 0
  const now = new Date()
  const diffTime = Math.abs(now - this.plantingDate)
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
})

// Virtual for days to harvest
cropSchema.virtual("daysToHarvest").get(function () {
  if (!this.expectedHarvestDate) return null
  const now = new Date()
  const diffTime = this.expectedHarvestDate - now
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
})

const Crop = mongoose.model("Crop", cropSchema)
export default Crop
