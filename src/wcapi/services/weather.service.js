import axios from "axios"
import { WeatherData } from "../models/weather.model.js"
import { logger } from "../utils/logger.js"

class WeatherService {
  constructor() {
    this.forecastBaseUrl = "https://api.open-meteo.com/v1/forecast"
    this.archiveBaseUrl = "https://archive-api.open-meteo.com/v1/archive"
    this.era5BaseUrl = "https://archive-api.open-meteo.com/v1/era5"
  }

  async getCurrentWeather(latitude, longitude) {
    try {
      const response = await axios.get(this.forecastBaseUrl, {
        params: {
          latitude,
          longitude,
          current:
            "temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,wind_direction_10m,surface_pressure,cloud_cover",
          timezone: "auto",
        },
      })

      const weatherData = this.transformCurrentWeatherData(response.data)

      // Store in database
      await this.storeWeatherData(weatherData)

      return weatherData
    } catch (error) {
      logger.error("Error fetching current weather:", error)
      throw new Error("Failed to fetch current weather data")
    }
  }

  async getForecast(latitude, longitude, days = 7) {
    try {
      const response = await axios.get(this.forecastBaseUrl, {
        params: {
          latitude,
          longitude,
          daily: "temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max",
          hourly:
            "temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,wind_direction_10m,surface_pressure,cloud_cover",
          forecast_days: days,
          timezone: "auto",
        },
      })

      const forecastData = this.transformForecastData(response.data)

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
    try {
      const response = await axios.get(this.archiveBaseUrl, {
        params: {
          latitude,
          longitude,
          start_date: startDate,
          end_date: endDate,
          daily: "temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max",
          hourly:
            "temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,wind_direction_10m,surface_pressure,cloud_cover",
          timezone: "auto",
        },
      })

      const historicalData = this.transformHistoricalData(response.data)

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

  transformCurrentWeatherData(data) {
    const current = data.current

    if (!current) {
      throw new Error("Invalid weather data received")
    }

    return {
      location: {
        latitude: data.latitude,
        longitude: data.longitude,
      },
      timestamp: new Date(current.time),
      type: "current",
      data: {
        temperature: current.temperature_2m,
        humidity: current.relative_humidity_2m || 0,
        precipitation: current.precipitation || 0,
        windSpeed: current.wind_speed_10m,
        windDirection: current.wind_direction_10m,
        pressure: current.surface_pressure || 0,
        cloudCover: current.cloud_cover || 0,
      },
      source: "Clycites-Weather-API",
    }
  }

  transformForecastData(data) {
    const hourly = data.hourly
    const times = hourly.time

    if (!hourly || !times) {
      throw new Error("Invalid forecast data received")
    }

    return times.map((time, index) => ({
      location: {
        latitude: data.latitude,
        longitude: data.longitude,
      },
      timestamp: new Date(time),
      type: "forecast",
      data: {
        temperature: hourly.temperature_2m[index],
        humidity: hourly.relative_humidity_2m[index] || 0,
        precipitation: hourly.precipitation[index] || 0,
        windSpeed: hourly.wind_speed_10m[index] || 0,
        windDirection: hourly.wind_direction_10m[index] || 0,
        pressure: hourly.surface_pressure[index] || 0,
        cloudCover: hourly.cloud_cover[index] || 0,
      },
      source: "Clycites-Weather-API",
    }))
  }

  transformHistoricalData(data) {
    const hourly = data.hourly
    const times = hourly.time

    if (!hourly || !times) {
      throw new Error("Invalid historical data received")
    }

    return times.map((time, index) => ({
      location: {
        latitude: data.latitude,
        longitude: data.longitude,
      },
      timestamp: new Date(time),
      type: "historical",
      data: {
        temperature: hourly.temperature_2m[index] || 0,
        humidity: hourly.relative_humidity_2m[index] || 0,
        precipitation: hourly.precipitation[index] || 0,
        windSpeed: hourly.wind_speed_10m[index] || 0,
        windDirection: hourly.wind_direction_10m[index] || 0,
        pressure: hourly.surface_pressure[index] || 0,
        cloudCover: hourly.cloud_cover[index] || 0,
      },
      source: "Clycites-Weather-API",
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
