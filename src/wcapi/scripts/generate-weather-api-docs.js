/**
 * This script generates API documentation for the ClyCites Weather API
 */

// Generate API documentation in Markdown format
const generateApiDocs = () => {
  const docs = `
# ClyCites Weather API Documentation

## Overview
The ClyCites Weather API provides comprehensive access to weather data, including current conditions, forecasts, historical data, air quality information, and climate projections. This API leverages the Open-Meteo data source and allows for highly customizable requests.

## Base URL
\`\`\`
https://api.clycites.com/api/weather
\`\`\`

## Authentication
All API requests require an API key. Include your API key in the request header:

\`\`\`
X-API-Key: your_api_key_here
\`\`\`

## Available Endpoints

### Get Available Variables
Returns all available weather variables that can be requested.

\`\`\`
GET /variables
\`\`\`

#### Response Example
\`\`\`json
{
  "success": true,
  "message": "Available weather variables retrieved successfully",
  "data": {
    "hourly": ["temperature_2m", "relative_humidity_2m", ...],
    "daily": ["temperature_2m_max", "temperature_2m_min", ...],
    "airQuality": ["pm10", "pm2_5", ...],
    "climate": ["temperature_2m_max", "temperature_2m_min", ...],
    "climateModels": ["CMCC_CM2_VHR4", "EC_Earth3P_HR", ...]
  }
}
\`\`\`

### Get Current Weather
Returns current weather conditions for a specific location.

\`\`\`
GET /current
\`\`\`

#### Query Parameters
- \`latitude\` (required): Location latitude (-90 to 90)
- \`longitude\` (required): Location longitude (-180 to 180)
- \`variables\` (optional): Comma-separated list of weather variables
- \`timezone\` (optional): Timezone name (default: "auto")
- \`temperatureUnit\` (optional): Unit for temperature values (default: "celsius")
- \`windSpeedUnit\` (optional): Unit for wind speed values (default: "kmh")
- \`precipitationUnit\` (optional): Unit for precipitation values (default: "mm")

#### Response Example
\`\`\`json
{
  "success": true,
  "message": "Current weather data retrieved successfully",
  "data": {
    "location": {
      "latitude": 52.52,
      "longitude": 13.41,
      "timezone": "Europe/Berlin",
      "timezoneAbbreviation": "CEST",
      "elevation": 44
    },
    "timestamp": "2023-06-05T12:00:00Z",
    "type": "current",
    "data": {
      "temperature_2m": 22.4,
      "relative_humidity_2m": 65,
      "precipitation": 0
    },
    "source": "ClyCites-Weather-API",
    "units": {
      "temperature": "°C",
      "precipitation": "mm",
      "windSpeed": "km/h",
      "pressure": "hPa"
    }
  }
}
\`\`\`

### Get Weather Forecast
Returns weather forecast for a specific location.

\`\`\`
GET /forecast
\`\`\`

#### Query Parameters
- \`latitude\` (required): Location latitude (-90 to 90)
- \`longitude\` (required): Location longitude (-180 to 180)
- \`hourlyVariables\` (optional): Comma-separated list of hourly weather variables
- \`dailyVariables\` (optional): Comma-separated list of daily weather variables
- \`days\` (optional): Number of forecast days (1-16, default: 7)
- \`timezone\` (optional): Timezone name (default: "auto")
- \`temperatureUnit\` (optional): Unit for temperature values (default: "celsius")
- \`windSpeedUnit\` (optional): Unit for wind speed values (default: "kmh")
- \`precipitationUnit\` (optional): Unit for precipitation values (default: "mm")

#### Response Example
\`\`\`json
{
  "success": true,
  "message": "Weather forecast data retrieved successfully",
  "data": {
    "location": {
      "latitude": 52.52,
      "longitude": 13.41,
      "timezone": "Europe/Berlin",
      "timezoneAbbreviation": "CEST",
      "elevation": 44
    },
    "hourly": [
      {
        "timestamp": "2023-06-05T12:00:00Z",
        "data": {
          "temperature_2m": 22.4,
          "relative_humidity_2m": 65
        }
      },
      // More hourly data...
    ],
    "daily": [
      {
        "date": "2023-06-05",
        "data": {
          "temperature_2m_max": 24.6,
          "temperature_2m_min": 14.2,
          "precipitation_sum": 0.5
        }
      },
      // More daily data...
    ],
    "units": {
      "temperature": "°C",
      "precipitation": "mm",
      "windSpeed": "km/h",
      "pressure": "hPa"
    }
  }
}
\`\`\`

### Get Historical Weather
Returns historical weather data for a specific location and time period.

\`\`\`
GET /historical
\`\`\`

#### Query Parameters
- \`latitude\` (required): Location latitude (-90 to 90)
- \`longitude\` (required): Location longitude (-180 to 180)
- \`startDate\` (required): Start date in YYYY-MM-DD format
- \`endDate\` (required): End date in YYYY-MM-DD format
- \`hourlyVariables\` (optional): Comma-separated list of hourly weather variables
- \`dailyVariables\` (optional): Comma-separated list of daily weather variables
- \`timezone\` (optional): Timezone name (default: "auto")
- \`temperatureUnit\` (optional): Unit for temperature values (default: "celsius")
- \`windSpeedUnit\` (optional): Unit for wind speed values (default: "kmh")
- \`precipitationUnit\` (optional): Unit for precipitation values (default: "mm")

#### Response Example
Similar to forecast endpoint response.

### Get Air Quality
Returns air quality data for a specific location.

\`\`\`
GET /air-quality
\`\`\`

#### Query Parameters
- \`latitude\` (required): Location latitude (-90 to 90)
- \`longitude\` (required): Location longitude (-180 to 180)
- \`variables\` (optional): Comma-separated list of air quality variables
- \`days\` (optional): Number of forecast days (1-5, default: 5)
- \`timezone\` (optional): Timezone name (default: "auto")

#### Response Example
\`\`\`json
{
  "success": true,
  "message": "Air quality data retrieved successfully",
  "data": {
    "location": {
      "latitude": 52.52,
      "longitude": 13.41,
      "timezone": "Europe/Berlin",
      "timezoneAbbreviation": "CEST"
    },
    "hourly": [
      {
        "timestamp": "2023-06-05T12:00:00Z",
        "data": {
          "pm10": 15.2,
          "pm2_5": 8.7,
          "european_aqi": 32
        }
      },
      // More hourly data...
    ],
    "units": {
      "pm10": "μg/m³",
      "pm2_5": "μg/m³",
      "european_aqi": "index"
    }
  }
}
\`\`\`

### Get Climate Projection
Returns climate projection data for a specific location and time period.

\`\`\`
GET /climate
\`\`\`

#### Query Parameters
- \`latitude\` (required): Location latitude (-90 to 90)
- \`longitude\` (required): Location longitude (-180 to 180)
- \`startDate\` (required): Start date in YYYY-MM-DD format
- \`endDate\` (required): End date in YYYY-MM-DD format
- \`variables\` (optional): Comma-separated list of climate variables
- \`models\` (optional): Comma-separated list of climate models
- \`timezone\` (optional): Timezone name (default: "auto")
- \`temperatureUnit\` (optional): Unit for temperature values (default: "celsius")
- \`windSpeedUnit\` (optional): Unit for wind speed values (default: "kmh")
- \`precipitationUnit\` (optional): Unit for precipitation values (default: "mm")

#### Response Example
\`\`\`json
{
  "success": true,
  "message": "Climate projection data retrieved successfully",
  "data": {
    "location": {
      "latitude": 52.52,
      "longitude": 13.41,
      "timezone": "Europe/Berlin",
      "timezoneAbbreviation": "CEST",
      "elevation": 44
    },
    "models": ["EC_Earth3P_HR"],
    "daily": [
      {
        "date": "2030-06-05",
        "data": {
          "temperature_2m_max": 26.8,
          "temperature_2m_min": 16.3,
          "precipitation_sum": 1.2
        }
      },
      // More daily data...
    ],
    "units": {
      "temperature": "°C",
      "precipitation": "mm",
      "windSpeed": "km/h",
      "pressure": "hPa"
    }
  }
}
\`\`\`

## Error Responses
All endpoints return a consistent error format:

\`\`\`json
{
  "success": false,
  "message": "Error message description",
  "errors": [
    {
      "param": "latitude",
      "msg": "Invalid value",
      "location": "query"
    }
  ]
}
\`\`\`

## Rate Limiting
The API has a rate limit of 1000 requests per 15 minutes per IP address.

## Support
For API support, please contact api-support@clycites.com
`

  return docs
}

// Execute the function and log the output
const apiDocs = generateApiDocs()
console.log(apiDocs)

// In a real environment, this would write to a file or database
console.log("\nAPI documentation generated successfully!")
