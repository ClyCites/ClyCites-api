import axios from "axios"
import { getRedisClient } from "../config/redis.js"
import { WeatherData } from "../models/weather.model.js"
import { logger } from "../utils/logger.js"

class WeatherService {
  constructor() {
    this.baseUrl = "https://api.open-meteo.com/v1"
    this.redis = getRedisClient()
  }

  async getCurrentWeather(latitude, longitude) {
    const cacheKey = `weather:current:${latitude}:${longitude}`

    try {
      // Check cache first
      const cached = await this.redis.get(cacheKey)
      if (cached) {
        return JSON.parse(cached)
      }

      const response = await axios.get(`${this.baseUrl}/forecast`, {
        params: {
          latitude,
          longitude,
          current_weather: true,
          hourly:
            "temperature_2m,relative_humidity_2m,precipitation,windspeed_10m,winddirection_10m,surface_pressure,cloudcover",
          timezone: "auto",
        },
      })

      const weatherData = this.transformWeatherData(response.data, "current")

      // Cache for 10 minutes
      await this.redis.setex(cacheKey, 600, JSON.stringify(weatherData))

      // Store in database
      await this.storeWeatherData(weatherData)

      return weatherData
    } catch (error) {
      logger.error("Error fetching current weather:", error)
      throw new Error("Failed to fetch current weather data")
    }
  }

  async getForecast(latitude, longitude, days = 7) {
    const cacheKey = `weather:forecast:${latitude}:${longitude}:${days}`

    try {
      const cached = await this.redis.get(cacheKey)
      if (cached) {
        return JSON.parse(cached)
      }

      const response = await axios.get(`${this.baseUrl}/forecast`, {
        params: {
          latitude,
          longitude,
          daily: "temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max",
          hourly:
            "temperature_2m,relative_humidity_2m,precipitation,windspeed_10m,winddirection_10m,surface_pressure,cloudcover",
          forecast_days: days,
          timezone: "auto",
        },
      })

      const forecastData = this.transformForecastData(response.data)

      // Cache for 1 hour
      await this.redis.setex(cacheKey, 3600, JSON.stringify(forecastData))

      // Store in database
      for (const data of forecastData) {
        await this.storeWeatherData(data)
      }

      return forecastData
    } catch (error) {
      logger.error("Error fetching weather forecast:", error)
      throw new Error("Failed to fetch weather forecast data")
    }
  }

  async getHistoricalWeather(latitude, longitude, startDate, endDate) {
    const cacheKey = `weather:historical:${latitude}:${longitude}:${startDate}:${endDate}`

    try {
      const cached = await this.redis.get(cacheKey)
      if (cached) {
        return JSON.parse(cached)
      }

      const response = await axios.get(`${this.baseUrl}/archive`, {
        params: {
          latitude,
          longitude,
          start_date: startDate,
          end_date: endDate,
          daily: "temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max",
          timezone: "auto",
        },
      })

      const historicalData = this.transformHistoricalData(response.data)

      // Cache for 24 hours (historical data doesn't change)
      await this.redis.setex(cacheKey, 86400, JSON.stringify(historicalData))

      // Store in database
      for (const data of historicalData) {
        await this.storeWeatherData(data)
      }

      return historicalData
    } catch (error) {
      logger.error("Error fetching historical weather:", error)
      throw new Error("Failed to fetch historical weather data")
    }
  }

  transformWeatherData(data, type) {
    const current = data.current_weather
    const hourly = data.hourly

    if (!current || !hourly) {
      throw new Error("Invalid weather data received")
    }

    return {
      location: {
        latitude: data.latitude,
        longitude: data.longitude,
      },
      timestamp: new Date(current.time),
      type,
      data: {
        temperature: current.temperature,
        humidity: hourly.relative_humidity_2m[0] || 0,
        precipitation: hourly.precipitation[0] || 0,
        windSpeed: current.windspeed,
        windDirection: current.winddirection,
        pressure: hourly.surface_pressure[0] || 0,
        cloudCover: hourly.cloudcover[0] || 0,
      },
      source: "open-meteo",
    }
  }

  transformForecastData(data) {
    const daily = data.daily
    const hourly = data.hourly

    if (!daily || !hourly) {
      throw new Error("Invalid forecast data received")
    }

    return daily.time.map((time, index) => ({
      location: {
        latitude: data.latitude,
        longitude: data.longitude,
      },
      timestamp: new Date(time),
      type: "forecast",
      data: {
        temperature: daily.temperature_2m_max[index],
        humidity: hourly.relative_humidity_2m[index * 24] || 0,
        precipitation: daily.precipitation_sum[index],
        windSpeed: daily.windspeed_10m_max[index],
        windDirection: hourly.winddirection_10m[index * 24] || 0,
        pressure: hourly.surface_pressure[index * 24] || 0,
        cloudCover: hourly.cloudcover[index * 24] || 0,
      },
      source: "open-meteo",
    }))
  }

  transformHistoricalData(data) {
    const daily = data.daily

    if (!daily) {
      throw new Error("Invalid historical data received")
    }

    return daily.time.map((time, index) => ({
      location: {
        latitude: data.latitude,
        longitude: data.longitude,
      },
      timestamp: new Date(time),
      type: "historical",
      data: {
        temperature: daily.temperature_2m_max[index],
        humidity: 0, // Historical data might not include all parameters
        precipitation: daily.precipitation_sum[index],
        windSpeed: daily.windspeed_10m_max[index],
        windDirection: 0,
        pressure: 0,
        cloudCover: 0,
      },
      source: "open-meteo",
    }))
  }

  async storeWeatherData(weatherData) {
    try {
      await WeatherData.findOneAndUpdate(
        {
          "location.latitude": weatherData.location.latitude,
          "location.longitude": weatherData.location.longitude,
          timestamp: weatherData.timestamp,
          type: weatherData.type,
        },
        weatherData,
        { upsert: true, new: true },
      )
    } catch (error) {
      logger.error("Error storing weather data:", error)
    }
  }
}

export const weatherService = new WeatherService()
