/**
 * This script demonstrates example API calls to the ClyCites Weather API
 */

// Example API calls with sample responses
const generateExamples = () => {
  const examples = {
    getCurrentWeather: {
      request: `
GET /api/weather/current?latitude=0.3476&longitude=32.5825&variables=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m
`,
      response: `
{
  "success": true,
  "message": "Current weather data retrieved successfully",
  "data": {
    "location": {
      "latitude": 0.3476,
      "longitude": 32.5825,
      "timezone": "Africa/Kampala",
      "timezoneAbbreviation": "EAT",
      "elevation": 1189
    },
    "timestamp": "2023-06-05T15:00:00Z",
    "type": "current",
    "data": {
      "temperature_2m": 23.8,
      "relative_humidity_2m": 72,
      "precipitation": 0,
      "wind_speed_10m": 3.2
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
`,
    },
    getForecast: {
      request: `
GET /api/weather/forecast?latitude=0.3476&longitude=32.5825&hourlyVariables=temperature_2m,precipitation_probability&dailyVariables=temperature_2m_max,temperature_2m_min,precipitation_sum&days=3
`,
      response: `
{
  "success": true,
  "message": "Weather forecast data retrieved successfully",
  "data": {
    "location": {
      "latitude": 0.3476,
      "longitude": 32.5825,
      "timezone": "Africa/Kampala",
      "timezoneAbbreviation": "EAT",
      "elevation": 1189
    },
    "hourly": [
      {
        "timestamp": "2023-06-05T00:00:00Z",
        "data": {
          "temperature_2m": 19.2,
          "precipitation_probability": 0
        }
      },
      {
        "timestamp": "2023-06-05T01:00:00Z",
        "data": {
          "temperature_2m": 18.7,
          "precipitation_probability": 0
        }
      },
      // More hourly data...
    ],
    "daily": [
      {
        "date": "2023-06-05",
        "data": {
          "temperature_2m_max": 25.6,
          "temperature_2m_min": 18.2,
          "precipitation_sum": 0
        }
      },
      {
        "date": "2023-06-06",
        "data": {
          "temperature_2m_max": 26.1,
          "temperature_2m_min": 18.5,
          "precipitation_sum": 2.3
        }
      },
      {
        "date": "2023-06-07",
        "data": {
          "temperature_2m_max": 24.8,
          "temperature_2m_min": 18.9,
          "precipitation_sum": 5.7
        }
      }
    ],
    "units": {
      "temperature": "°C",
      "precipitation": "mm",
      "windSpeed": "km/h",
      "pressure": "hPa"
    }
  }
}
`,
    },
    getHistoricalWeather: {
      request: `
GET /api/weather/historical?latitude=0.3476&longitude=32.5825&startDate=2022-01-01&endDate=2022-01-07&hourlyVariables=temperature_2m,precipitation&dailyVariables=temperature_2m_max,temperature_2m_min,precipitation_sum
`,
      response: `
{
  "success": true,
  "message": "Historical weather data retrieved successfully",
  "data": {
    "location": {
      "latitude": 0.3476,
      "longitude": 32.5825,
      "timezone": "Africa/Kampala",
      "timezoneAbbreviation": "EAT",
      "elevation": 1189
    },
    "hourly": [
      {
        "timestamp": "2022-01-01T00:00:00Z",
        "data": {
          "temperature_2m": 20.3,
          "precipitation": 0
        }
      },
      // More hourly data...
    ],
    "daily": [
      {
        "date": "2022-01-01",
        "data": {
          "temperature_2m_max": 26.7,
          "temperature_2m_min": 19.2,
          "precipitation_sum": 0
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
`,
    },
    getClimateProjection: {
      request: `
GET /api/weather/climate?latitude=0.3476&longitude=32.5825&startDate=2030-01-01&endDate=2030-12-31&variables=temperature_2m_max,temperature_2m_min,precipitation_sum
`,
      response: `
{
  "success": true,
  "message": "Climate projection data retrieved successfully",
  "data": {
    "location": {
      "latitude": 0.3476,
      "longitude": 32.5825,
      "timezone": "Africa/Kampala",
      "timezoneAbbreviation": "EAT",
      "elevation": 1189
    },
    "daily": [
      {
        "date": "2030-01-01",
        "data": {
          "temperature_2m_max": 27.3,
          "temperature_2m_min": 19.8,
          "precipitation_sum": 0.2
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
`,
    },
  }

  return examples
}

// Execute the function and log the output
const apiExamples = generateExamples()

console.log("ClyCites Weather API Examples\n")

for (const [endpoint, data] of Object.entries(apiExamples)) {
  console.log(`\n=== ${endpoint} ===\n`)
  console.log("Request:")
  console.log(data.request)
  console.log("Response:")
  console.log(data.response)
  console.log("\n---")
}

console.log("\nExample API calls generated successfully!")
