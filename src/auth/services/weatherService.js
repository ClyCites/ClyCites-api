import axios from "axios"
import { WeatherData } from "../models/weatherModel.js"
import logger from "../utils/logger.js"

class WeatherService {
  constructor() {
    this.forecastBaseUrl = "https://api.open-meteo.com/v1/forecast"
    this.archiveBaseUrl = "https://archive-api.open-meteo.com/v1/archive"
    this.era5BaseUrl = "https://archive-api.open-meteo.com/v1/era5"
    this.climateBaseUrl = "https://api.open-meteo.com/v1/climate"

    // Define available variable groups for easy reference
    this.availableVariables = {
      hourly: [
        "temperature_2m",
        "relative_humidity_2m",
        "dew_point_2m",
        "apparent_temperature",
        "precipitation",
        "rain",
        "showers",
        "snowfall",
        "weather_code",
        "pressure_msl",
        "surface_pressure",
        "cloud_cover",
        "cloud_cover_low",
        "cloud_cover_mid",
        "cloud_cover_high",
        "wind_speed_10m",
        "wind_direction_10m",
        "wind_gusts_10m",
        "shortwave_radiation",
        "direct_radiation",
        "diffuse_radiation",
        "direct_normal_irradiance",
        "global_tilted_irradiance",
        "terrestrial_radiation",
        "evapotranspiration",
        "soil_temperature_0cm",
        "soil_temperature_6cm",
        "soil_temperature_18cm",
        "soil_temperature_54cm",
        "soil_moisture_0_1cm",
        "soil_moisture_1_3cm",
        "soil_moisture_3_9cm",
        "soil_moisture_9_27cm",
        "soil_moisture_27_81cm",
        "is_day",
        "sunshine_duration",
        "uv_index",
        "uv_index_clear_sky",
        "freezing_level_height",
        "precipitation_probability",
      ],
      daily: [
        "temperature_2m_max",
        "temperature_2m_min",
        "apparent_temperature_max",
        "apparent_temperature_min",
        "precipitation_sum",
        "rain_sum",
        "showers_sum",
        "snowfall_sum",
        "precipitation_hours",
        "sunrise",
        "sunset",
        "windspeed_10m_max",
        "windgusts_10m_max",
        "winddirection_10m_dominant",
        "shortwave_radiation_sum",
        "et0_fao_evapotranspiration",
        "uv_index_max",
        "uv_index_clear_sky_max",
        "freezing_level_height_max",
        "freezing_level_height_min",
        "weather_code",
      ],
      climate: [
        "temperature_2m_max",
        "temperature_2m_min",
        "temperature_2m_mean",
        "relative_humidity_2m_max",
        "relative_humidity_2m_min",
        "relative_humidity_2m_mean",
        "precipitation_sum",
        "rain_sum",
        "snowfall_sum",
        "wind_speed_10m_mean",
        "wind_speed_10m_max",
        "cloud_cover_mean",
        "soil_moisture_0_to_10cm_mean",
        "pressure_msl_mean",
        "shortwave_radiation_sum",
      ],
    }
  }

  /**
   * Get current weather with customizable variables
   * @param {number} latitude - Location latitude
   * @param {number} longitude - Location longitude
   * @param {string[]} variables - Array of hourly variables to request
   * @param {Object} options - Additional options like units, timezone
   * @returns {Promise<Object>} Weather data
   */
  async getCurrentWeather(latitude, longitude, variables = [], options = {}) {
    try {
      // If no variables specified, use a default set
      const currentVariables =
        variables.length > 0
          ? variables
          : [
              "temperature_2m",
              "relative_humidity_2m",
              "precipitation",
              "wind_speed_10m",
              "wind_direction_10m",
              "surface_pressure",
              "cloud_cover",
            ]

      // Validate requested variables
      const validVariables = currentVariables.filter((v) => this.availableVariables.hourly.includes(v))

      if (validVariables.length === 0) {
        throw new Error("No valid variables requested")
      }

      const params = {
        latitude,
        longitude,
        current: validVariables.join(","),
        timezone: options.timezone || "auto",
        temperature_unit: options.temperatureUnit || "celsius",
        wind_speed_unit: options.windSpeedUnit || "kmh",
        precipitation_unit: options.precipitationUnit || "mm",
      }

      const response = await axios.get(this.forecastBaseUrl, { params })
      const weatherData = this.transformCurrentWeatherData(response.data, validVariables)

      // Store in database
      await this.storeWeatherData(weatherData)

      return weatherData
    } catch (error) {
      logger.error("Error fetching current weather:", error)
      throw new Error(`Failed to fetch current weather data: ${error.message}`)
    }
  }

  /**
   * Get weather forecast with customizable variables
   * @param {number} latitude - Location latitude
   * @param {number} longitude - Location longitude
   * @param {Object} params - Request parameters
   * @param {string[]} params.hourlyVariables - Array of hourly variables to request
   * @param {string[]} params.dailyVariables - Array of daily variables to request
   * @param {number} params.days - Number of forecast days
   * @param {Object} options - Additional options like units, timezone
   * @returns {Promise<Object>} Forecast data
   */
  async getForecast(latitude, longitude, params = {}, options = {}) {
    try {
      const days = params.days || 7

      // Default variables if none specified
      const hourlyVariables =
        params.hourlyVariables?.length > 0
          ? params.hourlyVariables.filter((v) => this.availableVariables.hourly.includes(v))
          : ["temperature_2m", "relative_humidity_2m", "precipitation", "wind_speed_10m"]

      const dailyVariables =
        params.dailyVariables?.length > 0
          ? params.dailyVariables.filter((v) => this.availableVariables.daily.includes(v))
          : ["temperature_2m_max", "temperature_2m_min", "precipitation_sum"]

      const requestParams = {
        latitude,
        longitude,
        forecast_days: days,
        timezone: options.timezone || "auto",
        temperature_unit: options.temperatureUnit || "celsius",
        wind_speed_unit: options.windSpeedUnit || "kmh",
        precipitation_unit: options.precipitationUnit || "mm",
      }

      if (hourlyVariables.length > 0) {
        requestParams.hourly = hourlyVariables.join(",")
      }

      if (dailyVariables.length > 0) {
        requestParams.daily = dailyVariables.join(",")
      }

      const response = await axios.get(this.forecastBaseUrl, { params: requestParams })

      const forecastData = {
        location: {
          latitude: response.data.latitude,
          longitude: response.data.longitude,
          timezone: response.data.timezone,
          timezoneAbbreviation: response.data.timezone_abbreviation,
          elevation: response.data.elevation,
        },
        hourly: hourlyVariables.length > 0 ? this.transformHourlyForecastData(response.data) : [],
        daily: dailyVariables.length > 0 ? this.transformDailyForecastData(response.data) : [],
        units: this.extractUnits(response.data),
      }

      // Store hourly data in database
      if (forecastData.hourly.length > 0) {
        for (const data of forecastData.hourly) {
          await this.storeWeatherData({
            ...data,
            type: "forecast",
          })
        }
      }

      return forecastData
    } catch (error) {
      logger.error("Error fetching weather forecast:", error)
      throw new Error(`Failed to fetch weather forecast data: ${error.message}`)
    }
  }

  /**
   * Get historical weather data with customizable variables
   * @param {number} latitude - Location latitude
   * @param {number} longitude - Location longitude
   * @param {string} startDate - Start date in YYYY-MM-DD format
   * @param {string} endDate - End date in YYYY-MM-DD format
   * @param {Object} params - Request parameters
   * @param {string[]} params.hourlyVariables - Array of hourly variables to request
   * @param {string[]} params.dailyVariables - Array of daily variables to request
   * @param {Object} options - Additional options like units, timezone
   * @returns {Promise<Object>} Historical weather data
   */
  async getHistoricalWeather(latitude, longitude, startDate, endDate, params = {}, options = {}) {
    try {
      // Default variables if none specified
      const hourlyVariables =
        params.hourlyVariables?.length > 0
          ? params.hourlyVariables.filter((v) => this.availableVariables.hourly.includes(v))
          : ["temperature_2m", "relative_humidity_2m", "precipitation"]

      const dailyVariables =
        params.dailyVariables?.length > 0
          ? params.dailyVariables.filter((v) => this.availableVariables.daily.includes(v))
          : ["temperature_2m_max", "temperature_2m_min", "precipitation_sum"]

      const requestParams = {
        latitude,
        longitude,
        start_date: startDate,
        end_date: endDate,
        timezone: options.timezone || "auto",
        temperature_unit: options.temperatureUnit || "celsius",
        wind_speed_unit: options.windSpeedUnit || "kmh",
        precipitation_unit: options.precipitationUnit || "mm",
      }

      if (hourlyVariables.length > 0) {
        requestParams.hourly = hourlyVariables.join(",")
      }

      if (dailyVariables.length > 0) {
        requestParams.daily = dailyVariables.join(",")
      }

      const response = await axios.get(this.archiveBaseUrl, { params: requestParams })

      const historicalData = {
        location: {
          latitude: response.data.latitude,
          longitude: response.data.longitude,
          timezone: response.data.timezone,
          timezoneAbbreviation: response.data.timezone_abbreviation,
          elevation: response.data.elevation,
        },
        hourly: hourlyVariables.length > 0 ? this.transformHourlyHistoricalData(response.data) : [],
        daily: dailyVariables.length > 0 ? this.transformDailyHistoricalData(response.data) : [],
        units: this.extractUnits(response.data),
      }

      // Store hourly data in database
      if (historicalData.hourly.length > 0) {
        for (const data of historicalData.hourly) {
          await this.storeWeatherData({
            ...data,
            type: "historical",
          })
        }
      }

      return historicalData
    } catch (error) {
      logger.error("Error fetching historical weather:", error)
      throw new Error(`Failed to fetch historical weather data: ${error.message}`)
    }
  }

  /**
   * Get climate projection data with customizable variables
   * @param {number} latitude - Location latitude
   * @param {number} longitude - Location longitude
   * @param {string} startDate - Start date in YYYY-MM-DD format
   * @param {string} endDate - End date in YYYY-MM-DD format
   * @param {Object} params - Request parameters
   * @param {string[]} params.variables - Array of climate variables to request
   * @param {Object} options - Additional options like units, timezone
   * @returns {Promise<Object>} Climate projection data
   */
  async getClimateProjection(latitude, longitude, startDate, endDate, params = {}, options = {}) {
    try {
      // Default variables if none specified
      const climateVariables =
        params.variables?.length > 0
          ? params.variables.filter((v) => this.availableVariables.climate.includes(v))
          : ["temperature_2m_max", "temperature_2m_min", "precipitation_sum"]

      if (climateVariables.length === 0) {
        throw new Error("No valid climate variables requested")
      }

      const requestParams = {
        latitude,
        longitude,
        start_date: startDate,
        end_date: endDate,
        daily: climateVariables.join(","),
        timezone: options.timezone || "auto",
        temperature_unit: options.temperatureUnit || "celsius",
        wind_speed_unit: options.windSpeedUnit || "kmh",
        precipitation_unit: options.precipitationUnit || "mm",
      }

      const response = await axios.get(this.climateBaseUrl, { params: requestParams })

      const climateData = {
        location: {
          latitude: response.data.latitude,
          longitude: response.data.longitude,
          timezone: response.data.timezone,
          timezoneAbbreviation: response.data.timezone_abbreviation,
          elevation: response.data.elevation,
        },
        daily: this.transformClimateData(response.data),
        units: this.extractUnits(response.data),
      }

      return climateData
    } catch (error) {
      logger.error("Error fetching climate projection data:", error)
      throw new Error(`Failed to fetch climate projection data: ${error.message}`)
    }
  }

  transformCurrentWeatherData(data, requestedVariables) {
    const current = data.current

    if (!current) {
      throw new Error("Invalid weather data received")
    }

    const transformedData = {
      location: {
        latitude: data.latitude,
        longitude: data.longitude,
        timezone: data.timezone || "UTC",
        timezoneAbbreviation: data.timezone_abbreviation || "UTC",
        elevation: data.elevation,
      },
      timestamp: new Date(current.time),
      type: "current",
      data: {},
      source: "ClyCites-Weather-API",
      units: this.extractUnits(data),
    }

    // Add all requested variables to the data object
    requestedVariables.forEach((variable) => {
      if (current[variable] !== undefined) {
        transformedData.data[variable] = current[variable]
      }
    })

    return transformedData
  }

  transformHourlyForecastData(data) {
    const hourly = data.hourly
    const times = hourly.time

    if (!hourly || !times) {
      throw new Error("Invalid forecast data received")
    }

    return times.map((time, index) => {
      const hourlyData = {}

      // Add all available hourly variables
      Object.keys(hourly).forEach((key) => {
        if (key !== "time") {
          hourlyData[key] = hourly[key][index]
        }
      })

      return {
        location: {
          latitude: data.latitude,
          longitude: data.longitude,
          timezone: data.timezone || "UTC",
          timezoneAbbreviation: data.timezone_abbreviation || "UTC",
          elevation: data.elevation,
        },
        timestamp: new Date(time),
        data: hourlyData,
        source: "ClyCites-Weather-API",
      }
    })
  }

  transformDailyForecastData(data) {
    const daily = data.daily
    const times = daily.time

    if (!daily || !times) {
      return []
    }

    return times.map((time, index) => {
      const dailyData = {}

      // Add all available daily variables
      Object.keys(daily).forEach((key) => {
        if (key !== "time") {
          dailyData[key] = daily[key][index]
        }
      })

      return {
        date: time,
        data: dailyData,
      }
    })
  }

  transformHourlyHistoricalData(data) {
    const hourly = data.hourly
    const times = hourly.time

    if (!hourly || !times) {
      throw new Error("Invalid historical data received")
    }

    return times.map((time, index) => {
      const hourlyData = {}

      // Add all available hourly variables
      Object.keys(hourly).forEach((key) => {
        if (key !== "time") {
          hourlyData[key] = hourly[key][index]
        }
      })

      return {
        location: {
          latitude: data.latitude,
          longitude: data.longitude,
          timezone: data.timezone || "UTC",
          timezoneAbbreviation: data.timezone_abbreviation || "UTC",
          elevation: data.elevation,
        },
        timestamp: new Date(time),
        data: hourlyData,
        source: "ClyCites-Weather-API",
      }
    })
  }

  transformDailyHistoricalData(data) {
    const daily = data.daily
    const times = daily?.time

    if (!daily || !times) {
      return []
    }

    return times.map((time, index) => {
      const dailyData = {}

      // Add all available daily variables
      Object.keys(daily).forEach((key) => {
        if (key !== "time") {
          dailyData[key] = daily[key][index]
        }
      })

      return {
        date: time,
        data: dailyData,
      }
    })
  }

  transformClimateData(data) {
    const daily = data.daily
    const times = daily.time

    if (!daily || !times) {
      throw new Error("Invalid climate data received")
    }

    return times.map((time, index) => {
      const dailyData = {}

      // Add all available daily variables
      Object.keys(daily).forEach((key) => {
        if (key !== "time") {
          dailyData[key] = daily[key][index]
        }
      })

      return {
        date: time,
        data: dailyData,
      }
    })
  }

  extractUnits(data) {
    const units = {
      temperature: data.daily_units?.temperature_2m_max || data.hourly_units?.temperature_2m || "°C",
      precipitation: data.daily_units?.precipitation_sum || data.hourly_units?.precipitation || "mm",
      windSpeed: data.hourly_units?.wind_speed_10m || "km/h",
      pressure: data.hourly_units?.surface_pressure || "hPa",
    }

    return units
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

  /**
   * Get available weather variables
   * @returns {Object} Object containing all available variables by category
   */
  getAvailableVariables() {
    return this.availableVariables
  }

  /**
   * Get weather data for a specific location and time range
   * @param {number} latitude - Location latitude
   * @param {number} longitude - Location longitude
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @param {string} type - Weather data type
   * @returns {Promise<Array>} Weather data array
   */
  async getStoredWeatherData(latitude, longitude, startDate, endDate, type = null) {
    try {
      const query = {
        "location.latitude": { $gte: latitude - 0.01, $lte: latitude + 0.01 },
        "location.longitude": { $gte: longitude - 0.01, $lte: longitude + 0.01 },
        timestamp: { $gte: startDate, $lte: endDate },
      }

      if (type) {
        query.type = type
      }

      const weatherData = await WeatherData.find(query).sort({ timestamp: 1 })
      return weatherData
    } catch (error) {
      logger.error("Error retrieving stored weather data:", error)
      throw new Error(`Failed to retrieve stored weather data: ${error.message}`)
    }
  }
}

export const weatherService = new WeatherService()
