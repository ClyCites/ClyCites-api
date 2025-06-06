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
      console.log("❌ Please run the main database seeding first to create users and organizations")
      console.log("Run: npm run seed")
      process.exit(1)
    }

    console.log(`🏢 Found ${organizations.length} organizations`)
    console.log(`👥 Found ${users.length} users`)

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
    ]

    console.log("🚜 Creating sample farms...")
    const createdFarms = await Farm.create(sampleFarms)
    console.log(`✅ Created ${createdFarms.length} farms`)

    // Sample crop data
    const sampleCrops = [
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
    ]

    console.log("🌱 Creating sample crops...")
    const createdCrops = await Crop.create(sampleCrops)
    console.log(`✅ Created ${createdCrops.length} crops`)

    // Sample agriculture activities
    const sampleActivities = [
      {
        type: "irrigation",
        farm: createdFarms[0]._id,
        crop: createdCrops[0]._id,
        performedBy: users[0]._id,
        actualDate: new Date("2024-03-20"),
        duration: { value: 2, unit: "hours" },
        inputs: [
          {
            type: "water",
            name: "Irrigation Water",
            quantity: 1000,
            unit: "liters",
            cost: 5000,
          },
        ],
        results: {
          success: true,
          observations: "Good water distribution across the field",
          recommendations: "Continue regular irrigation schedule",
        },
        status: "completed",
      },
      {
        type: "fertilization",
        farm: createdFarms[0]._id,
        crop: createdCrops[1]._id,
        performedBy: users[0]._id,
        actualDate: new Date("2024-04-05"),
        duration: { value: 3, unit: "hours" },
        inputs: [
          {
            type: "fertilizer",
            name: "NPK 17-17-17",
            quantity: 50,
            unit: "kg",
            cost: 75000,
            applicationRate: "50kg per hectare",
          },
        ],
        results: {
          success: true,
          observations: "Even application achieved",
          recommendations: "Monitor crop response over next 2 weeks",
        },
        status: "completed",
      },
      {
        type: "pest_control",
        farm: createdFarms[1]._id,
        crop: createdCrops[2]._id,
        performedBy: users[1]._id,
        actualDate: new Date("2024-05-10"),
        duration: { value: 4, unit: "hours" },
        inputs: [
          {
            type: "pesticide",
            name: "Coffee Berry Borer Control",
            quantity: 2,
            unit: "liters",
            cost: 45000,
            applicationRate: "2ml per liter of water",
          },
        ],
        results: {
          success: true,
          observations: "Reduced pest activity observed",
          recommendations: "Repeat treatment in 2 weeks if necessary",
        },
        status: "completed",
      },
    ]

    console.log("📅 Creating sample agriculture activities...")
    const createdActivities = await AgricultureActivity.create(sampleActivities)
    console.log(`✅ Created ${createdActivities.length} agriculture activities`)

    // Sample AI recommendations
    const sampleRecommendations = [
      {
        farm: createdFarms[0]._id,
        crop: createdCrops[0]._id,
        user: users[0]._id,
        type: "irrigation",
        priority: "high",
        title: "Increase Irrigation Frequency",
        description:
          "Based on current weather conditions and soil moisture levels, increase irrigation frequency to maintain optimal growth during the flowering stage.",
        actionRequired: true,
        deadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
        weatherContext: {
          currentConditions: { temperature: 28, humidity: 65, rainfall: 0 },
          forecast: { expectedRainfall: 5, temperature: 30 },
          alerts: ["High temperature expected"],
        },
        cropContext: {
          growthStage: "flowering",
          ageInDays: 65,
          expectedActions: ["irrigation", "monitoring"],
        },
        economicImpact: {
          potentialLoss: 200000,
          potentialGain: 50000,
          costOfAction: 15000,
          roi: 233,
          currency: "UGX",
        },
        confidence: 85,
        aiModel: "gpt-4",
        dataSource: ["weather_data", "crop_stage", "soil_moisture"],
        status: "active",
        tags: ["irrigation", "flowering", "weather_alert"],
      },
      {
        farm: createdFarms[1]._id,
        crop: createdCrops[2]._id,
        user: users[1]._id,
        type: "harvest_timing",
        priority: "medium",
        title: "Prepare for Coffee Harvest",
        description:
          "Coffee cherries are approaching optimal ripeness. Begin preparations for harvest including equipment maintenance and labor scheduling.",
        actionRequired: true,
        deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 2 weeks from now
        cropContext: {
          growthStage: "fruiting",
          ageInDays: 950,
          expectedActions: ["harvest_preparation", "quality_assessment"],
        },
        economicImpact: {
          potentialGain: 1500000,
          costOfAction: 200000,
          roi: 650,
          currency: "UGX",
        },
        confidence: 92,
        aiModel: "gpt-4",
        dataSource: ["crop_stage", "historical_data", "market_prices"],
        status: "active",
        tags: ["harvest", "coffee", "timing"],
      },
      {
        farm: createdFarms[0]._id,
        crop: createdCrops[1]._id,
        user: users[0]._id,
        type: "pest_control",
        priority: "critical",
        title: "Monitor for Bean Fly Infestation",
        description:
          "Weather conditions are favorable for bean fly activity. Implement monitoring and be ready for immediate intervention if pests are detected.",
        actionRequired: true,
        deadline: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000), // 1 day from now
        weatherContext: {
          currentConditions: { temperature: 25, humidity: 80, rainfall: 15 },
          forecast: { expectedRainfall: 20, temperature: 26 },
          alerts: ["High humidity conditions"],
        },
        cropContext: {
          growthStage: "vegetative",
          ageInDays: 35,
          expectedActions: ["pest_monitoring", "preventive_treatment"],
        },
        economicImpact: {
          potentialLoss: 180000,
          costOfAction: 25000,
          roi: 620,
          currency: "UGX",
        },
        confidence: 78,
        aiModel: "gpt-4",
        dataSource: ["weather_data", "pest_forecast", "crop_vulnerability"],
        status: "active",
        tags: ["pest_control", "beans", "monitoring"],
      },
    ]

    console.log("💡 Creating sample AI recommendations...")
    const createdRecommendations = await AIRecommendation.create(sampleRecommendations)
    console.log(`✅ Created ${createdRecommendations.length} AI recommendations`)

    // Sample weather data
    const sampleWeatherData = [
      {
        location: {
          latitude: 0.3476,
          longitude: 32.5825,
          timezone: "Africa/Kampala",
          timezoneAbbreviation: "EAT",
          elevation: 1190,
        },
        timestamp: new Date("2024-06-01T12:00:00Z"),
        type: "current",
        data: {
          temperature_2m: 25.5,
          relative_humidity_2m: 75,
          precipitation: 0,
          wind_speed_10m: 8.2,
          surface_pressure: 1013.2,
          cloud_cover: 45,
          soil_moisture_0_1cm: 0.28,
        },
        source: "open-meteo",
        units: {
          temperature: "°C",
          precipitation: "mm",
          windSpeed: "km/h",
          pressure: "hPa",
        },
      },
      {
        location: {
          latitude: 0.4162,
          longitude: 32.6722,
          timezone: "Africa/Kampala",
          timezoneAbbreviation: "EAT",
          elevation: 1200,
        },
        timestamp: new Date("2024-06-01T12:00:00Z"),
        type: "current",
        data: {
          temperature_2m: 23.8,
          relative_humidity_2m: 82,
          precipitation: 2.5,
          wind_speed_10m: 6.1,
          surface_pressure: 1012.8,
          cloud_cover: 65,
          soil_moisture_0_1cm: 0.35,
        },
        source: "open-meteo",
        units: {
          temperature: "°C",
          precipitation: "mm",
          windSpeed: "km/h",
          pressure: "hPa",
        },
      },
    ]

    console.log("🌡️ Creating sample weather data...")
    const createdWeatherData = await WeatherData.create(sampleWeatherData)
    console.log(`✅ Created ${createdWeatherData.length} weather data entries`)

    console.log("\n🎉 Agricultural data seeding completed successfully!")
    console.log("\n📊 Summary:")
    console.log(`   • ${createdFarms.length} farms created`)
    console.log(`   • ${createdCrops.length} crops created`)
    console.log(`   • ${createdActivities.length} activities created`)
    console.log(`   • ${createdRecommendations.length} AI recommendations created`)
    console.log(`   • ${createdWeatherData.length} weather data entries created`)

    console.log("\n🚀 You can now:")
    console.log("   • Test the weather API endpoints")
    console.log("   • Generate AI recommendations")
    console.log("   • Track agricultural activities")
    console.log("   • Monitor crop growth stages")

    process.exit(0)
  } catch (error) {
    console.error("❌ Error during agricultural data seeding:", error)
    console.error("Stack trace:", error.stack)
    process.exit(1)
  }
}

// Run the seeding function
seedAgriculturalData()
