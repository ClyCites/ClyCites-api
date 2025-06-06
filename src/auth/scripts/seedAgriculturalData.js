import dotenv from "dotenv"
import { connectDB } from "../config/db.js"
import User from "../models/userModel.js"
import Organization from "../models/organizationModel.js"
import Farm from "../models/farmModel.js"
import Crop from "../models/cropModel.js"
import AgricultureActivity from "../models/agricultureActivityModel.js"
import AIRecommendation from "../models/aiRecommendationModel.js"
import { WeatherData } from "../models/weatherModel.js"

dotenv.config()

const seedAgriculturalData = async () => {
  try {
    console.log("🌾 Starting agricultural data seeding...")

    await connectDB()

    // Get existing users and organizations
    const users = await User.find().limit(5)
    const organizations = await Organization.find().limit(3)

    if (users.length === 0 || organizations.length === 0) {
      console.log("❌ Please run the main database seeding first: npm run seed")
      process.exit(1)
    }

    console.log(
      "🏢 Found organizations:",
      organizations.map((o) => o.name),
    )
    console.log(
      "👥 Found users:",
      users.map((u) => u.email),
    )

    // Clear existing agricultural data
    console.log("🗑️  Clearing existing agricultural data...")
    await Promise.all([
      Farm.deleteMany({}),
      Crop.deleteMany({}),
      AgricultureActivity.deleteMany({}),
      AIRecommendation.deleteMany({}),
      WeatherData.deleteMany({}),
    ])

    // Sample farm data for Uganda
    const sampleFarms = [
      {
        name: "Green Valley Farm",
        owner: users[0]._id,
        organization: organizations[0]._id,
        location: {
          latitude: 0.3476,
          longitude: 32.5825,
          address: "Kampala District, Central Region, Uganda",
          region: "Central",
          country: "Uganda",
          elevation: 1190,
        },
        size: {
          value: 5.5,
          unit: "hectares",
        },
        soilType: "loam",
        soilPH: 6.8,
        irrigationSystem: "drip",
        farmType: "crop",
        certifications: [
          {
            type: "organic",
            name: "Uganda Organic Certification",
            issuedBy: "UGOCERT",
            validUntil: new Date("2025-12-31"),
            certificateNumber: "UG-ORG-2024-001",
          },
        ],
        weatherStationId: "kampala_001",
      },
      {
        name: "Sunrise Coffee Estate",
        owner: users[1]._id,
        organization: organizations[0]._id,
        location: {
          latitude: 0.4162,
          longitude: 32.6722,
          address: "Mukono District, Central Region, Uganda",
          region: "Central",
          country: "Uganda",
          elevation: 1200,
        },
        size: {
          value: 12.3,
          unit: "hectares",
        },
        soilType: "clay",
        soilPH: 6.2,
        irrigationSystem: "sprinkler",
        farmType: "crop",
        certifications: [
          {
            type: "fair_trade",
            name: "Fair Trade Coffee Certification",
            issuedBy: "Fairtrade International",
            validUntil: new Date("2025-06-30"),
            certificateNumber: "FT-UG-2024-002",
          },
        ],
        weatherStationId: "mukono_001",
      },
      {
        name: "Highland Dairy Farm",
        owner: users[2]._id,
        organization: organizations[1]._id,
        location: {
          latitude: 0.6519,
          longitude: 30.6566,
          address: "Mbarara District, Western Region, Uganda",
          region: "Western",
          country: "Uganda",
          elevation: 1420,
        },
        size: {
          value: 25.0,
          unit: "hectares",
        },
        soilType: "sandy",
        soilPH: 7.1,
        irrigationSystem: "center_pivot",
        farmType: "mixed",
        certifications: [],
        weatherStationId: "mbarara_001",
      },
      {
        name: "Nile Valley Vegetables",
        owner: users[3]._id,
        organization: organizations[1]._id,
        location: {
          latitude: 2.2042,
          longitude: 32.2955,
          address: "Gulu District, Northern Region, Uganda",
          region: "Northern",
          country: "Uganda",
          elevation: 1104,
        },
        size: {
          value: 8.7,
          unit: "hectares",
        },
        soilType: "silt",
        soilPH: 6.5,
        irrigationSystem: "flood",
        farmType: "crop",
        certifications: [
          {
            type: "global_gap",
            name: "GlobalGAP Certification",
            issuedBy: "GlobalGAP",
            validUntil: new Date("2025-09-15"),
            certificateNumber: "GG-UG-2024-003",
          },
        ],
        weatherStationId: "gulu_001",
      },
      {
        name: "Lake Victoria Fish Farm",
        owner: users[4]._id,
        organization: organizations[2]._id,
        location: {
          latitude: -0.3949,
          longitude: 32.6256,
          address: "Entebbe, Wakiso District, Central Region, Uganda",
          region: "Central",
          country: "Uganda",
          elevation: 1134,
        },
        size: {
          value: 3.2,
          unit: "hectares",
        },
        soilType: "peat",
        soilPH: 7.8,
        irrigationSystem: "none",
        farmType: "aquaculture",
        certifications: [],
        weatherStationId: "entebbe_001",
      },
    ]

    console.log("🚜 Creating sample farms...")
    const createdFarms = await Farm.create(sampleFarms)
    console.log(`✅ Created ${createdFarms.length} farms`)

    // Sample crop data
    const sampleCrops = [
      // Green Valley Farm crops
      {
        name: "Maize",
        scientificName: "Zea mays",
        category: "cereals",
        variety: "Longe 5",
        farm: createdFarms[0]._id,
        field: {
          name: "Field A",
          area: { value: 2.0, unit: "hectares" },
          coordinates: [
            { latitude: 0.3476, longitude: 32.5825 },
            { latitude: 0.348, longitude: 32.5825 },
            { latitude: 0.348, longitude: 32.583 },
            { latitude: 0.3476, longitude: 32.583 },
          ],
        },
        season: "wet",
        plantingDate: new Date("2024-03-15"),
        expectedHarvestDate: new Date("2024-07-15"),
        growthStage: "flowering",
        plantingMethod: "direct_seeding",
        seedSource: {
          supplier: "NARO Seeds",
          variety: "Longe 5",
          batchNumber: "L5-2024-001",
          quantity: 25,
          cost: 150000,
        },
        expectedYield: {
          quantity: 8000,
          unit: "kg",
        },
        status: "growing",
        notes: "Good germination rate, regular monitoring for pests",
      },
      {
        name: "Beans",
        scientificName: "Phaseolus vulgaris",
        category: "legumes",
        variety: "K132",
        farm: createdFarms[0]._id,
        field: {
          name: "Field B",
          area: { value: 1.5, unit: "hectares" },
        },
        season: "wet",
        plantingDate: new Date("2024-04-01"),
        expectedHarvestDate: new Date("2024-07-01"),
        growthStage: "vegetative",
        plantingMethod: "direct_seeding",
        seedSource: {
          supplier: "Local Cooperative",
          variety: "K132",
          quantity: 30,
          cost: 90000,
        },
        expectedYield: {
          quantity: 2250,
          unit: "kg",
        },
        status: "growing",
      },
      // Sunrise Coffee Estate crops
      {
        name: "Coffee",
        scientificName: "Coffea arabica",
        category: "cash_crops",
        variety: "Bugisu AA",
        farm: createdFarms[1]._id,
        field: {
          name: "Coffee Block 1",
          area: { value: 8.0, unit: "hectares" },
        },
        season: "dry",
        plantingDate: new Date("2022-05-01"),
        expectedHarvestDate: new Date("2024-12-01"),
        growthStage: "fruiting",
        plantingMethod: "transplanting",
        seedSource: {
          supplier: "UCDA Certified Nursery",
          variety: "Bugisu AA",
          quantity: 2000,
          cost: 800000,
        },
        expectedYield: {
          quantity: 12000,
          unit: "kg",
        },
        status: "growing",
        notes: "Mature coffee trees, expecting good harvest this season",
      },
      // Highland Dairy Farm crops
      {
        name: "Napier Grass",
        scientificName: "Pennisetum purpureum",
        category: "fodder",
        variety: "Bana",
        farm: createdFarms[2]._id,
        field: {
          name: "Pasture 1",
          area: { value: 10.0, unit: "hectares" },
        },
        season: "wet",
        plantingDate: new Date("2024-01-01"),
        expectedHarvestDate: new Date("2024-06-01"),
        growthStage: "established",
        plantingMethod: "broadcasting",
        seedSource: {
          supplier: "Local Seed Supplier",
          variety: "Bana",
          quantity: 5000,
          cost: 250000,
        },
        expectedYield: {
          quantity: 15000,
          unit: "kg",
        },
        status: "growing",
      },
    ]

    console.log("🌱 Creating sample crops...")
    const createdCrops = await Crop.create(sampleCrops)
    console.log(`✅ Created ${createdCrops.length} crops`)

    // Sample agriculture activity data
    const sampleActivities = [
      {
        farm: createdFarms[0]._id,
        crop: createdCrops[0]._id,
        activityType: "irrigation",
        date: new Date("2024-03-20"),
        details: "Applied 100 liters of water using drip irrigation system",
      },
      {
        farm: createdFarms[1]._id,
        crop: createdCrops[2]._id,
        activityType: "pruning",
        date: new Date("2024-05-10"),
        details: "Pruned coffee trees to improve air circulation",
      },
      {
        farm: createdFarms[2]._id,
        crop: createdCrops[3]._id,
        activityType: "fertilization",
        date: new Date("2024-02-15"),
        details: "Applied 50 kg of NPK fertilizer",
      },
    ]

    console.log("📅 Creating sample agriculture activities...")
    const createdActivities = await AgricultureActivity.create(sampleActivities)
    console.log(`✅ Created ${createdActivities.length} agriculture activities`)

    // Sample AI recommendation data
    const sampleRecommendations = [
      {
        farm: createdFarms[0]._id,
        crop: createdCrops[0]._id,
        recommendationType: "pest_control",
        date: new Date("2024-04-01"),
        details: "Monitor for armyworms and apply insecticide if detected",
      },
      {
        farm: createdFarms[1]._id,
        crop: createdCrops[2]._id,
        recommendationType: "harvest_timing",
        date: new Date("2024-11-01"),
        details: "Harvest coffee cherries when they reach optimal ripeness",
      },
      {
        farm: createdFarms[2]._id,
        crop: createdCrops[3]._id,
        recommendationType: "soil_management",
        date: new Date("2024-03-01"),
        details: "Regularly test soil pH and adjust with lime if necessary",
      },
    ]

    console.log("💡 Creating sample AI recommendations...")
    const createdRecommendations = await AIRecommendation.create(sampleRecommendations)
    console.log(`✅ Created ${createdRecommendations.length} AI recommendations`)

    // Sample weather data
    const sampleWeatherData = [
      {
        farm: createdFarms[0]._id,
        date: new Date("2024-03-15"),
        temperature: { value: 25.0, unit: "°C" },
        humidity: { value: 75, unit: "%" },
        rainfall: { value: 100, unit: "mm" },
      },
      {
        farm: createdFarms[1]._id,
        date: new Date("2024-05-01"),
        temperature: { value: 22.0, unit: "°C" },
        humidity: { value: 80, unit: "%" },
        rainfall: { value: 50, unit: "mm" },
      },
      {
        farm: createdFarms[2]._id,
        date: new Date("2024-02-15"),
        temperature: { value: 18.0, unit: "°C" },
        humidity: { value: 65, unit: "%" },
        rainfall: { value: 0, unit: "mm" },
      },
    ]

    console.log("🌡️ Creating sample weather data...")
    const createdWeatherData = await WeatherData.create(sampleWeatherData)
    console.log(`✅ Created ${createdWeatherData.length} weather data entries`)

    console.log("🌾 Agricultural data seeding completed successfully!")
  } catch (error) {
    console.error("❌ Error during agricultural data seeding:", error)
    process.exit(1)
  }
}

export default seedAgriculturalData
