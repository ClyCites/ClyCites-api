import axios from "axios"
import Weather from "../models/Weather.js"
import { logger } from "../utils/logger.js"

class WeatherService {
  constructor() {
    this.apiKey = process.env.OPENWEATHER_API_KEY
    this.baseUrl = "https://api.openweathermap.org/data/2.5"
    this.oneCallUrl = "https://api.openweathermap.org/data/3.0/onecall"
    this.geocodingUrl = "https://api.openweathermap.org/geo/1.0"
  }

  async getCurrentWeather(lat, lon, userId) {
    try {
      // Check if we have recent data
      const existingWeather = await Weather.findOne({
        userId,
        "location.latitude": { $gte: lat - 0.01, $lte: lat + 0.01 },
        "location.longitude": { $gte: lon - 0.01, $lte: lon + 0.01 },
      }).sort({ "dataQuality.lastUpdated": -1 })

      // If data is less than 30 minutes old, return cached data
      if (existingWeather && !existingWeather.isStale(30)) {
        logger.info("Returning cached weather data")
        return existingWeather
      }

      // Fetch fresh data
      const [currentResponse, forecastResponse, locationData] = await Promise.all([
        this.fetchCurrentWeather(lat, lon),
        this.fetchForecast(lat, lon),
        this.getLocationInfo(lat, lon),
      ])

      const weatherData = this.formatCurrentWeather(currentResponse.data)
      const forecastData = this.formatForecast(forecastResponse.data)

      // Calculate agricultural metrics
      const agriculturalMetrics = this.calculateAgriculturalMetrics(weatherData, forecastData)

      // Generate alerts
      const alerts = this.generateWeatherAlerts(weatherData, forecastData)

      const weatherRecord = {
        userId,
        location: {
          latitude: lat,
          longitude: lon,
          city: locationData.city,
          country: locationData.country,
          region: locationData.region,
          timezone: forecastResponse.data.timezone,
        },
        current: weatherData,
        forecast: forecastData,
        agriculturalMetrics,
        alerts,
        dataQuality: {
          accuracy: 0.95, // OpenWeatherMap accuracy
          lastUpdated: new Date(),
          source: "openweathermap",
          apiCalls: 2,
        },
      }

      // Save to database
      const savedWeather = await Weather.findOneAndUpdate(
        {
          userId,
          "location.latitude": { $gte: lat - 0.01, $lte: lat + 0.01 },
          "location.longitude": { $gte: lon - 0.01, $lte: lon + 0.01 },
        },
        weatherRecord,
        { upsert: true, new: true },
      )

      logger.info("Weather data updated successfully")
      return savedWeather
    } catch (error) {
      logger.error("Error fetching weather data:", error)
      throw new Error("Failed to fetch weather data")
    }
  }

  async fetchCurrentWeather(lat, lon) {
    return axios.get(`${this.baseUrl}/weather`, {
      params: {
        lat,
        lon,
        appid: this.apiKey,
        units: "metric",
      },
    })
  }

  async fetchForecast(lat, lon) {
    return axios.get(`${this.oneCallUrl}`, {
      params: {
        lat,
        lon,
        appid: this.apiKey,
        units: "metric",
        exclude: "minutely",
      },
    })
  }

  async getLocationInfo(lat, lon) {
    try {
      const response = await axios.get(`${this.geocodingUrl}/reverse`, {
        params: {
          lat,
          lon,
          limit: 1,
          appid: this.apiKey,
        },
      })

      const location = response.data[0] || {}
      return {
        city: location.name || "Unknown",
        country: location.country || "Unknown",
        region: location.state || location.admin1 || "Unknown",
      }
    } catch (error) {
      logger.warn("Failed to get location info:", error.message)
      return { city: "Unknown", country: "Unknown", region: "Unknown" }
    }
  }

  formatCurrentWeather(data) {
    return {
      temperature: data.main.temp,
      feelsLike: data.main.feels_like,
      humidity: data.main.humidity,
      pressure: data.main.pressure,
      windSpeed: data.wind?.speed || 0,
      windDirection: data.wind?.deg || 0,
      visibility: (data.visibility || 10000) / 1000, // Convert to km
      uvIndex: data.uvi || 0,
      cloudCover: data.clouds?.all || 0,
      description: data.weather[0]?.description || "Unknown",
      icon: data.weather[0]?.icon || "01d",
      sunrise: new Date(data.sys.sunrise * 1000),
      sunset: new Date(data.sys.sunset * 1000),
    }
  }

  formatForecast(data) {
    return data.daily.slice(0, 7).map((day) => ({
      date: new Date(day.dt * 1000),
      temperature: {
        min: day.temp.min,
        max: day.temp.max,
        morning: day.temp.morn,
        day: day.temp.day,
        evening: day.temp.eve,
        night: day.temp.night,
      },
      humidity: day.humidity,
      precipitation: {
        probability: Math.round(day.pop * 100),
        amount: day.rain?.["1h"] || day.snow?.["1h"] || 0,
        type: day.rain ? "rain" : day.snow ? "snow" : "none",
      },
      windSpeed: day.wind_speed,
      windDirection: day.wind_deg,
      pressure: day.pressure,
      uvIndex: day.uvi,
      description: day.weather[0]?.description || "Unknown",
      icon: day.weather[0]?.icon || "01d",
    }))
  }

  calculateAgriculturalMetrics(current, forecast) {
    // Growing Degree Days calculation (base 10°C)
    const baseTemp = 10
    const gdd = forecast.reduce((acc, day) => {
      const avgTemp = (day.temperature.min + day.temperature.max) / 2
      return acc + Math.max(0, avgTemp - baseTemp)
    }, 0)

    // Soil temperature estimates
    const soilTemperature = {
      surface: current.temperature - 2,
      depth10cm: current.temperature - 3,
      depth50cm: current.temperature - 5,
    }

    // Evapotranspiration calculation
    const et = this.calculateEvapotranspiration(current, forecast)

    // Heat stress assessment
    const heatStress = this.assessHeatStress(current.temperature, forecast)

    // Moisture index
    const moistureIndex = this.calculateMoistureIndex(current, forecast)

    // Photoperiod (simplified)
    const photoperiod = this.calculatePhotoperiod(new Date())

    return {
      growingDegreeDays: Math.round(gdd * 10) / 10,
      soilTemperature,
      evapotranspiration: et,
      heatStress,
      moistureIndex,
      photoperiod,
    }
  }

  calculateEvapotranspiration(current, forecast) {
    // Simplified Penman-Monteith equation
    const temp = current.temperature
    const humidity = current.humidity
    const windSpeed = current.windSpeed

    const delta = (4098 * (0.6108 * Math.exp((17.27 * temp) / (temp + 237.3)))) / Math.pow(temp + 237.3, 2)
    const gamma = 0.665
    const u2 = (windSpeed * 4.87) / Math.log(67.8 * 10 - 5.42)

    const reference =
      (0.408 * delta * temp + ((gamma * 900) / (temp + 273)) * u2 * (0.01 * (100 - humidity))) /
      (delta + gamma * (1 + 0.34 * u2))

    return {
      reference: Math.max(0, Math.round(reference * 10) / 10),
      crop: Math.max(0, Math.round(reference * 1.2 * 10) / 10), // Crop coefficient of 1.2
    }
  }

  assessHeatStress(currentTemp, forecast) {
    const highTempDays = forecast.filter((day) => day.temperature.max > 35).length
    const consecutiveDays = this.getConsecutiveHighTempDays(forecast)

    let level = "low"
    if (currentTemp > 40 || consecutiveDays > 5) level = "extreme"
    else if (currentTemp > 35 || consecutiveDays > 3) level = "high"
    else if (currentTemp > 30 || consecutiveDays > 1) level = "moderate"

    return {
      level,
      duration: highTempDays,
      consecutiveDays,
    }
  }

  getConsecutiveHighTempDays(forecast) {
    let consecutive = 0
    let maxConsecutive = 0

    for (const day of forecast) {
      if (day.temperature.max > 35) {
        consecutive++
        maxConsecutive = Math.max(maxConsecutive, consecutive)
      } else {
        consecutive = 0
      }
    }

    return maxConsecutive
  }

  calculateMoistureIndex(current, forecast) {
    const totalRainfall = forecast.reduce((sum, day) => sum + day.precipitation.amount, 0)
    const avgHumidity = forecast.reduce((sum, day) => sum + day.humidity, 0) / forecast.length

    // Simplified moisture index (0-100)
    const rainfallScore = Math.min(totalRainfall * 2, 50)
    const humidityScore = avgHumidity * 0.5

    return Math.round(rainfallScore + humidityScore)
  }

  calculatePhotoperiod(date) {
    // Simplified photoperiod calculation (hours of daylight)
    const dayOfYear = Math.floor((date - new Date(date.getFullYear(), 0, 0)) / 86400000)
    const declination = 23.45 * Math.sin((((360 * (284 + dayOfYear)) / 365) * Math.PI) / 180)

    // Assuming latitude of 0 for simplification
    const hourAngle = Math.acos(-Math.tan(0) * Math.tan((declination * Math.PI) / 180))
    const photoperiod = (2 * hourAngle * 12) / Math.PI

    return Math.round(photoperiod * 10) / 10
  }

  generateWeatherAlerts(current, forecast) {
    const alerts = []
    const now = new Date()

    // Frost alert
    const frostRisk = forecast.some((day) => day.temperature.min < 2)
    if (frostRisk) {
      alerts.push({
        type: "frost",
        severity: current.temperature < 0 ? "critical" : "high",
        title: "Frost Warning",
        message: "Frost conditions expected. Protect sensitive crops with covers or move potted plants indoors.",
        recommendations: [
          "Cover sensitive plants with frost cloth",
          "Water plants before sunset to increase thermal mass",
          "Move potted plants to sheltered areas",
        ],
        startTime: now,
        endTime: new Date(now.getTime() + 48 * 60 * 60 * 1000),
        isActive: true,
      })
    }

    // Drought alert
    const lowRainfall = forecast.every((day) => day.precipitation.amount < 1)
    if (lowRainfall && current.humidity < 30) {
      alerts.push({
        type: "drought",
        severity: "moderate",
        title: "Dry Conditions",
        message: "Extended dry period expected. Monitor soil moisture and consider irrigation.",
        recommendations: [
          "Check soil moisture levels regularly",
          "Implement water conservation techniques",
          "Consider drip irrigation systems",
        ],
        startTime: now,
        endTime: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        isActive: true,
      })
    }

    // Heat wave alert
    if (current.temperature > 35) {
      alerts.push({
        type: "heatwave",
        severity: current.temperature > 40 ? "critical" : "high",
        title: "Extreme Heat Warning",
        message: "High temperatures may stress crops. Ensure adequate water supply and consider shade protection.",
        recommendations: [
          "Increase irrigation frequency",
          "Provide shade for sensitive crops",
          "Harvest early morning when temperatures are cooler",
        ],
        startTime: now,
        endTime: new Date(now.getTime() + 24 * 60 * 60 * 1000),
        isActive: true,
      })
    }

    // High wind alert
    if (current.windSpeed > 15) {
      alerts.push({
        type: "wind",
        severity: current.windSpeed > 25 ? "high" : "moderate",
        title: "High Wind Warning",
        message: "Strong winds may damage crops. Secure loose structures and support tall plants.",
        recommendations: [
          "Stake tall plants and trees",
          "Secure greenhouse structures",
          "Avoid spraying pesticides or fertilizers",
        ],
        startTime: now,
        endTime: new Date(now.getTime() + 12 * 60 * 60 * 1000),
        isActive: true,
      })
    }

    return alerts
  }

  async getHistoricalWeather(lat, lon, startDate, endDate) {
    // This would require historical weather API or database
    // For now, return empty array as placeholder
    try {
      logger.info("Historical weather data requested but not implemented")
      return []
    } catch (error) {
      logger.error("Error fetching historical weather:", error)
      throw new Error("Failed to fetch historical weather data")
    }
  }
}

export default new WeatherService()
