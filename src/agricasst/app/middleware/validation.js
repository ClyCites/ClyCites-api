import { ApiResponse } from "../utils/apiResponse.js"

export const validateCoordinates = (req, res, next) => {
  const { lat, lon } = req.query

  if (!lat || !lon) {
    return res.status(400).json(ApiResponse.error("Latitude and longitude are required"))
  }

  const latitude = Number.parseFloat(lat)
  const longitude = Number.parseFloat(lon)

  if (isNaN(latitude) || isNaN(longitude)) {
    return res.status(400).json(ApiResponse.error("Invalid latitude or longitude format"))
  }

  if (latitude < -90 || latitude > 90) {
    return res.status(400).json(ApiResponse.error("Latitude must be between -90 and 90"))
  }

  if (longitude < -180 || longitude > 180) {
    return res.status(400).json(ApiResponse.error("Longitude must be between -180 and 180"))
  }

  next()
}

export const validateCropData = (req, res, next) => {
  const { name, category } = req.body

  if (!name || !category) {
    return res.status(400).json(ApiResponse.error("Crop name and category are required"))
  }

  const validCategories = ["cereal", "legume", "vegetable", "fruit", "cash_crop", "forage", "spice", "medicinal"]
  if (!validCategories.includes(category)) {
    return res.status(400).json(ApiResponse.error("Invalid crop category"))
  }

  next()
}

export const validatePagination = (req, res, next) => {
  const { page = 1, limit = 20 } = req.query

  const pageNum = Number.parseInt(page)
  const limitNum = Number.parseInt(limit)

  if (isNaN(pageNum) || pageNum < 1) {
    return res.status(400).json(ApiResponse.error("Page must be a positive integer"))
  }

  if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
    return res.status(400).json(ApiResponse.error("Limit must be between 1 and 100"))
  }

  req.pagination = { page: pageNum, limit: limitNum }
  next()
}
