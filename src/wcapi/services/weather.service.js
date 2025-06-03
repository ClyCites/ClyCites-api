import axios from "axios"
import moment from "moment-timezone"
import geotz from "geo-tz"
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

      const weatherData = this.transformCurrentWeatherData(response.data, latitude, longitude)

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

      const forecastData = this.transformForecastData(response.data, latitude, longitude)

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

      const historicalData = this.transformHistoricalData(response.data, latitude, longitude)

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

  // Get timezone for a location
  getTimezone(latitude, longitude) {
    try {
      const timezones = geotz.find(latitude, longitude)
      return timezones && timezones.length > 0 ? timezones[0] : "UTC"
    } catch (error) {
      logger.error("Error getting timezone:", error)
      return "UTC"
    }
  }

  // Convert UTC time to local time
  convertToLocalTime(utcTime, latitude, longitude) {
    try {
      const timezone = this.getTimezone(latitude, longitude)
      return moment.utc(utcTime).tz(timezone).toDate()
    } catch (error) {
      logger.error("Error converting time:", error)
      return new Date(utcTime)
    }
  }

  transformCurrentWeatherData(data, latitude, longitude) {
    const current = data.current

    if (!current) {
      throw new Error("Invalid weather data received")
    }

    // Convert time to local time
    const localTime = this.convertToLocalTime(current.time, latitude, longitude)

    return {
      location: {
        latitude: data.latitude,
        longitude: data.longitude,
        timezone: this.getTimezone(latitude, longitude),
      },
      timestamp: localTime,
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
      originalTimestamp: new Date(current.time), // Keep original UTC time for reference
    }
  }

  transformForecastData(data, latitude, longitude) {
    const hourly = data.hourly
    const times = hourly.time

    if (!hourly || !times) {
      throw new Error("Invalid forecast data received")
    }

    const timezone = this.getTimezone(latitude, longitude)

    return times.map((time, index) => {
      // Convert time to local time
      const localTime = this.convertToLocalTime(time, latitude, longitude)

      return {
        location: {
          latitude: data.latitude,
          longitude: data.longitude,
          timezone,
        },
        timestamp: localTime,
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
        originalTimestamp: new Date(time), // Keep original UTC time for reference
      }
    })
  }

  transformHistoricalData(data, latitude, longitude) {
    const hourly = data.hourly
    const times = hourly.time

    if (!hourly || !times) {
      throw new Error("Invalid historical data received")
    }

    const timezone = this.getTimezone(latitude, longitude)

    return times.map((time, index) => {
      // Convert time to local time
      const localTime = this.convertToLocalTime(time, latitude, longitude)

      return {
        location: {
          latitude: data.latitude,
          longitude: data.longitude,
          timezone,
        },
        timestamp: localTime,
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
        originalTimestamp: new Date(time), // Keep original UTC time for reference
      }
    })
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
