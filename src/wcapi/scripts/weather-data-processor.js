/**
 * This script demonstrates how to process and analyze weather data
 * from the ClyCites Weather API
 */

// Sample weather data for demonstration
const sampleData = {
  location: {
    latitude: 0.3476,
    longitude: 32.5825,
    timezone: "Africa/Kampala",
    elevation: 1189,
  },
  daily: [
    {
      date: "2023-01-01",
      data: { temperature_2m_max: 26.7, temperature_2m_min: 19.2, precipitation_sum: 0 },
    },
    {
      date: "2023-01-02",
      data: { temperature_2m_max: 27.3, temperature_2m_min: 18.9, precipitation_sum: 0.2 },
    },
    {
      date: "2023-01-03",
      data: { temperature_2m_max: 28.1, temperature_2m_min: 19.5, precipitation_sum: 0 },
    },
    {
      date: "2023-01-04",
      data: { temperature_2m_max: 27.8, temperature_2m_min: 19.1, precipitation_sum: 0 },
    },
    {
      date: "2023-01-05",
      data: { temperature_2m_max: 26.9, temperature_2m_min: 18.7, precipitation_sum: 3.2 },
    },
    {
      date: "2023-01-06",
      data: { temperature_2m_max: 25.4, temperature_2m_min: 18.5, precipitation_sum: 12.7 },
    },
    {
      date: "2023-01-07",
      data: { temperature_2m_max: 24.2, temperature_2m_min: 18.3, precipitation_sum: 8.5 },
    },
  ],
}

// Calculate average temperature
const calculateAverageTemperature = (data) => {
  let sumMax = 0
  let sumMin = 0

  data.daily.forEach((day) => {
    sumMax += day.data.temperature_2m_max
    sumMin += day.data.temperature_2m_min
  })

  const avgMax = sumMax / data.daily.length
  const avgMin = sumMin / data.daily.length
  const avgMean = (avgMax + avgMin) / 2

  return {
    max: avgMax.toFixed(1),
    min: avgMin.toFixed(1),
    mean: avgMean.toFixed(1),
  }
}

// Calculate total precipitation
const calculateTotalPrecipitation = (data) => {
  let total = 0

  data.daily.forEach((day) => {
    total += day.data.precipitation_sum
  })

  return total.toFixed(1)
}

// Identify extreme weather days
const identifyExtremeWeatherDays = (data) => {
  const extremeDays = []

  data.daily.forEach((day) => {
    const conditions = []

    if (day.data.temperature_2m_max > 30) {
      conditions.push("Extreme heat")
    }

    if (day.data.precipitation_sum > 10) {
      conditions.push("Heavy rainfall")
    }

    if (conditions.length > 0) {
      extremeDays.push({
        date: day.date,
        conditions,
      })
    }
  })

  return extremeDays
}

// Generate weather summary
const generateWeatherSummary = (data) => {
  const avgTemp = calculateAverageTemperature(data)
  const totalPrecip = calculateTotalPrecipitation(data)
  const extremeDays = identifyExtremeWeatherDays(data)

  return {
    location: data.location,
    period: {
      start: data.daily[0].date,
      end: data.daily[data.daily.length - 1].date,
      days: data.daily.length,
    },
    averageTemperature: avgTemp,
    totalPrecipitation: totalPrecip,
    extremeWeatherDays: extremeDays,
    summary: `For the ${data.daily.length}-day period from ${data.daily[0].date} to ${data.daily[data.daily.length - 1].date}, the average temperature ranged from ${avgTemp.min}°C to ${avgTemp.max}°C with a mean of ${avgTemp.mean}°C. Total precipitation was ${totalPrecip}mm. ${extremeDays.length > 0 ? `${extremeDays.length} days with extreme weather conditions were identified.` : "No extreme weather conditions were identified."}`,
  }
}

// Process the sample data
const weatherSummary = generateWeatherSummary(sampleData)
console.log(JSON.stringify(weatherSummary, null, 2))

// Example of how to use this with the ClyCites Weather API
console.log("\nExample of how to use this with the ClyCites Weather API:")
console.log(`
// Fetch historical weather data
const fetchAndAnalyzeWeather = async (latitude, longitude, startDate, endDate) => {
  try {
    const response = await fetch(
      \`https://api.clycites.com/api/weather/historical?latitude=\${latitude}&longitude=\${longitude}&startDate=\${startDate}&endDate=\${endDate}&dailyVariables=temperature_2m_max,temperature_2m_min,precipitation_sum\`
    );
    
    const result = await response.json();
    
    if (result.success) {
      const weatherSummary = generateWeatherSummary(result.data);
      return weatherSummary;
    } else {
      throw new Error(result.message);
    }
  } catch (error) {
    console.error("Error analyzing weather data:", error);
    return null;
  }
};

// Usage
fetchAndAnalyzeWeather(0.3476, 32.5825, "2023-01-01", "2023-01-07")
  .then(summary => console.log(summary))
  .catch(error => console.error(error));
`)
