import mongoose from "mongoose"
import dotenv from "dotenv"
import Crop from "../app/models/Crop.js"
import { logger } from "../app/utils/logger.js"

dotenv.config()

const sampleCrops = [
  {
    name: "Tomato",
    scientificName: "Solanum lycopersicum",
    commonNames: ["Tomatoes", "Love Apple"],
    category: "vegetable",
    subCategory: "fruit vegetable",
    description: "Popular warm-season vegetable crop grown for fresh consumption and processing",

    growthStages: [
      {
        stage: "germination",
        duration: 7,
        description: "Seed germination and emergence",
        requirements: {
          temperature: { min: 18, max: 25, optimal: 22 },
          humidity: { min: 70, max: 85 },
          rainfall: { min: 0, max: 5 },
          sunlight: 0,
        },
        activities: ["Seed sowing", "Maintain soil moisture"],
        commonIssues: ["Poor germination", "Damping off"],
      },
      {
        stage: "vegetative",
        duration: 35,
        description: "Leaf and stem development",
        requirements: {
          temperature: { min: 20, max: 30, optimal: 25 },
          humidity: { min: 60, max: 80 },
          rainfall: { min: 20, max: 40 },
          sunlight: 8,
        },
        activities: ["Transplanting", "Staking", "Pruning"],
        commonIssues: ["Aphids", "Cutworms"],
      },
      {
        stage: "flowering",
        duration: 21,
        description: "Flower formation and pollination",
        requirements: {
          temperature: { min: 18, max: 28, optimal: 23 },
          humidity: { min: 50, max: 70 },
          rainfall: { min: 15, max: 30 },
          sunlight: 8,
        },
        activities: ["Pollination support", "Flower monitoring"],
        commonIssues: ["Blossom end rot", "Poor fruit set"],
      },
      {
        stage: "fruiting",
        duration: 45,
        description: "Fruit development and maturation",
        requirements: {
          temperature: { min: 20, max: 30, optimal: 25 },
          humidity: { min: 60, max: 75 },
          rainfall: { min: 25, max: 35 },
          sunlight: 8,
        },
        activities: ["Fruit support", "Harvesting"],
        commonIssues: ["Fruit cracking", "Late blight"],
      },
    ],

    climaticRequirements: {
      temperature: {
        optimal: { min: 20, max: 30 },
        tolerance: { min: 15, max: 35 },
        critical: { min: 10, max: 40 },
      },
      rainfall: {
        annual: { min: 600, max: 1200 },
        seasonal: "Well distributed",
        distribution: "Regular throughout growing season",
      },
      humidity: { min: 50, max: 80 },
      soilPH: { min: 6.0, max: 7.0 },
      altitude: { min: 0, max: 2000 },
    },

    soilRequirements: {
      type: ["loam", "sandy loam", "clay loam"],
      drainage: "good",
      fertility: "high",
      organicMatter: { min: 2, max: 5 },
      salinity: "sensitive",
    },

    plantingCalendar: [
      {
        region: "Tropical",
        climate: "Year-round",
        plantingWindow: { start: { month: 1, day: 1 }, end: { month: 12, day: 31 } },
        harvestWindow: { start: { month: 1, day: 1 }, end: { month: 12, day: 31 } },
        notes: "Avoid extreme wet season",
      },
      {
        region: "Temperate",
        climate: "Spring planting",
        plantingWindow: { start: { month: 3, day: 15 }, end: { month: 5, day: 15 } },
        harvestWindow: { start: { month: 6, day: 1 }, end: { month: 10, day: 31 } },
        notes: "Plant after last frost",
      },
    ],

    pests: [
      {
        name: "Tomato Hornworm",
        scientificName: "Manduca quinquemaculata",
        severity: "high",
        symptoms: ["Large holes in leaves", "Defoliation", "Green caterpillars"],
        prevention: ["Regular inspection", "Companion planting with basil"],
        treatment: ["Hand picking", "Bt spray", "Beneficial wasps"],
        seasonality: "Mid to late summer",
      },
      {
        name: "Aphids",
        scientificName: "Various species",
        severity: "moderate",
        symptoms: ["Curled leaves", "Sticky honeydew", "Yellowing"],
        prevention: ["Reflective mulch", "Beneficial insects"],
        treatment: ["Insecticidal soap", "Neem oil", "Water spray"],
        seasonality: "Spring and early summer",
      },
    ],

    diseases: [
      {
        name: "Late Blight",
        type: "fungal",
        severity: "high",
        symptoms: ["Dark spots on leaves", "White mold", "Fruit rot"],
        prevention: ["Good air circulation", "Avoid overhead watering"],
        treatment: ["Copper fungicide", "Remove affected plants"],
        conditions: "Cool, wet weather",
      },
      {
        name: "Blossom End Rot",
        type: "physiological",
        severity: "moderate",
        symptoms: ["Dark, sunken spots on fruit bottom"],
        prevention: ["Consistent watering", "Calcium availability"],
        treatment: ["Improve watering schedule", "Soil amendment"],
        conditions: "Inconsistent moisture, calcium deficiency",
      },
    ],

    marketInfo: {
      averagePrice: 2.5,
      priceUnit: "USD per kg",
      priceRange: { min: 1.5, max: 4.0 },
      demandLevel: "high",
      seasonality: "Peak summer demand",
      majorMarkets: ["Fresh market", "Processing", "Restaurants"],
      exportPotential: true,
      valueAddition: ["Sauce", "Paste", "Dried tomatoes"],
    },

    nutritionalValue: {
      calories: 18,
      protein: 0.9,
      carbohydrates: 3.9,
      fiber: 1.2,
      vitamins: ["Vitamin C", "Vitamin K", "Folate"],
      minerals: ["Potassium", "Manganese"],
    },

    cultivation: {
      seedRate: "200-300g per hectare",
      spacing: "60cm x 45cm",
      depth: "1-2cm",
      irrigationFrequency: "Every 2-3 days",
      fertilizer: {
        basal: "NPK 10-26-26 at 200kg/ha",
        topDressing: ["Urea at 4 weeks", "NPK 15-15-15 at flowering"],
      },
      intercropping: ["Basil", "Marigold", "Lettuce"],
      rotation: ["Legumes", "Brassicas", "Avoid nightshades"],
    },

    yield: {
      average: 40,
      potential: 80,
      unit: "tons per hectare",
      factors: ["Variety", "Climate", "Management practices"],
    },

    difficulty: "intermediate",
    region: ["Tropical", "Subtropical", "Temperate"],
  },

  {
    name: "Maize",
    scientificName: "Zea mays",
    commonNames: ["Corn", "Sweet Corn"],
    category: "cereal",
    subCategory: "grain crop",
    description: "Major cereal crop grown worldwide for food, feed, and industrial uses",

    growthStages: [
      {
        stage: "germination",
        duration: 10,
        description: "Seed germination and emergence",
        requirements: {
          temperature: { min: 10, max: 30, optimal: 25 },
          humidity: { min: 60, max: 80 },
          rainfall: { min: 25, max: 50 },
          sunlight: 6,
        },
        activities: ["Land preparation", "Seed sowing"],
        commonIssues: ["Poor germination", "Soil crusting"],
      },
      {
        stage: "vegetative",
        duration: 50,
        description: "Leaf development and stem elongation",
        requirements: {
          temperature: { min: 18, max: 32, optimal: 25 },
          humidity: { min: 50, max: 70 },
          rainfall: { min: 50, max: 100 },
          sunlight: 8,
        },
        activities: ["Weeding", "First fertilizer application"],
        commonIssues: ["Weed competition", "Nutrient deficiency"],
      },
      {
        stage: "flowering",
        duration: 20,
        description: "Tasseling and silking",
        requirements: {
          temperature: { min: 20, max: 30, optimal: 26 },
          humidity: { min: 60, max: 80 },
          rainfall: { min: 75, max: 125 },
          sunlight: 8,
        },
        activities: ["Pollination monitoring", "Pest control"],
        commonIssues: ["Poor pollination", "Corn borer"],
      },
      {
        stage: "maturity",
        duration: 40,
        description: "Grain filling and maturation",
        requirements: {
          temperature: { min: 15, max: 28, optimal: 22 },
          humidity: { min: 40, max: 60 },
          rainfall: { min: 25, max: 75 },
          sunlight: 8,
        },
        activities: ["Harvest preparation", "Drying"],
        commonIssues: ["Lodging", "Mycotoxins"],
      },
    ],

    climaticRequirements: {
      temperature: {
        optimal: { min: 20, max: 30 },
        tolerance: { min: 15, max: 35 },
        critical: { min: 10, max: 40 },
      },
      rainfall: {
        annual: { min: 500, max: 1200 },
        seasonal: "Well distributed during growing season",
        distribution: "Critical during flowering and grain filling",
      },
      humidity: { min: 50, max: 80 },
      soilPH: { min: 5.8, max: 7.5 },
      altitude: { min: 0, max: 3000 },
    },

    soilRequirements: {
      type: ["loam", "clay loam", "sandy loam"],
      drainage: "good",
      fertility: "moderate",
      organicMatter: { min: 1.5, max: 4 },
      salinity: "moderate",
    },

    plantingCalendar: [
      {
        region: "Tropical",
        climate: "Two seasons",
        plantingWindow: { start: { month: 3, day: 1 }, end: { month: 5, day: 31 } },
        harvestWindow: { start: { month: 7, day: 1 }, end: { month: 9, day: 30 } },
        notes: "Main season planting",
      },
      {
        region: "Temperate",
        climate: "Spring planting",
        plantingWindow: { start: { month: 4, day: 15 }, end: { month: 6, day: 15 } },
        harvestWindow: { start: { month: 9, day: 1 }, end: { month: 11, day: 30 } },
        notes: "Plant when soil temperature reaches 10°C",
      },
    ],

    marketInfo: {
      averagePrice: 0.25,
      priceUnit: "USD per kg",
      priceRange: { min: 0.15, max: 0.4 },
      demandLevel: "high",
      seasonality: "Stable year-round demand",
      majorMarkets: ["Animal feed", "Food processing", "Export"],
      exportPotential: true,
      valueAddition: ["Flour", "Starch", "Ethanol"],
    },

    yield: {
      average: 6,
      potential: 12,
      unit: "tons per hectare",
      factors: ["Variety", "Rainfall", "Soil fertility"],
    },

    difficulty: "beginner",
    region: ["Tropical", "Subtropical", "Temperate"],
  },
]

async function seedCrops() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/agric-assistant")
    logger.info("Connected to MongoDB for seeding")

    // Clear existing crops
    await Crop.deleteMany({})
    logger.info("Cleared existing crop data")

    // Insert sample crops
    const insertedCrops = await Crop.insertMany(sampleCrops)
    logger.info(`Inserted ${insertedCrops.length} sample crops`)

    logger.info("Crop seeding completed successfully")
    process.exit(0)
  } catch (error) {
    logger.error("Error seeding crops:", error)
    process.exit(1)
  }
}

// Run seeding if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedCrops()
}

export { seedCrops, sampleCrops }
