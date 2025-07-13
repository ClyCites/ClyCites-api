import { validationResult } from "express-validator"
import { aiRecommendationService } from "../services/aiRecommendationService.js"
import AIRecommendation from "../models/aiRecommendationModel.js"
import Farm from "../models/farmModel.js"
import OrganizationMember from "../models/organizationMemberModel.js"
import { asyncHandler } from "../utils/asyncHandler.js"
import { AppError } from "../utils/appError.js"

// @desc    Generate AI recommendations for a farm
// @route   POST /api/farms/:farmId/ai-recommendations
// @access  Private (Farm owner or org member)
export const generateRecommendations = asyncHandler(async (req, res, next) => {
  const farmId = req.params.farmId

  // Check farm access
  const farm = await Farm.findById(farmId)
  if (!farm) {
    return next(new AppError("Farm not found", 404))
  }

  const isOwner = farm.owner.toString() === req.user.id
  const membership = await OrganizationMember.findOne({
    user: req.user.id,
    organization: farm.organization,
    status: "active",
  })

  if (!isOwner && !membership) {
    return next(new AppError("Access denied", 403))
  }

  try {
    const recommendations = await aiRecommendationService.generateFarmRecommendations(farmId, req.user.id)

    res.status(200).json({
      success: true,
      message: "AI recommendations generated successfully",
      data: {
        recommendations,
        count: recommendations.length,
        generatedAt: new Date(),
      },
    })
  } catch (error) {
    return next(new AppError(`Failed to generate recommendations: ${error.message}`, 500))
  }
})

// @desc    Get active recommendations for a farm
// @route   GET /api/farms/:farmId/ai-recommendations
// @access  Private (Farm owner or org member)
export const getRecommendations = asyncHandler(async (req, res, next) => {
  const farmId = req.params.farmId
  const { type, priority, status = "active", limit = 50 } = req.query

  // Check farm access
  const farm = await Farm.findById(farmId)
  if (!farm) {
    return next(new AppError("Farm not found", 404))
  }

  const isOwner = farm.owner.toString() === req.user.id
  const membership = await OrganizationMember.findOne({
    user: req.user.id,
    organization: farm.organization,
    status: "active",
  })

  if (!isOwner && !membership) {
    return next(new AppError("Access denied", 403))
  }

  try {
    const filters = {
      type,
      priority,
      status,
      limit: Number.parseInt(limit),
    }

    const recommendations = await aiRecommendationService.getActiveRecommendations(farmId, req.user.id, filters)

    // Calculate statistics
    const stats = {
      total: recommendations.length,
      byPriority: {
        critical: recommendations.filter((r) => r.priority === "critical").length,
        high: recommendations.filter((r) => r.priority === "high").length,
        medium: recommendations.filter((r) => r.priority === "medium").length,
        low: recommendations.filter((r) => r.priority === "low").length,
      },
      byType: recommendations.reduce((acc, r) => {
        acc[r.type] = (acc[r.type] || 0) + 1
        return acc
      }, {}),
      averageConfidence: recommendations.reduce((sum, r) => sum + r.confidence, 0) / recommendations.length || 0,
    }

    res.status(200).json({
      success: true,
      data: {
        recommendations,
        statistics: stats,
        filters: filters,
      },
    })
  } catch (error) {
    return next(new AppError(`Failed to fetch recommendations: ${error.message}`, 500))
  }
})

// @desc    Get specific recommendation details
// @route   GET /api/ai-recommendations/:recommendationId
// @access  Private (Recommendation recipient)
export const getRecommendationDetails = asyncHandler(async (req, res, next) => {
  const recommendationId = req.params.recommendationId

  try {
    const recommendation = await AIRecommendation.findOne({
      _id: recommendationId,
      user: req.user.id,
    })
      .populate("farm", "name location")
      .populate("crop", "name category growthStage")
      .populate("relatedActivities", "activityType status actualDate")

    if (!recommendation) {
      return next(new AppError("Recommendation not found", 404))
    }

    res.status(200).json({
      success: true,
      data: { recommendation },
    })
  } catch (error) {
    return next(new AppError(`Failed to fetch recommendation: ${error.message}`, 500))
  }
})

// @desc    Update recommendation status
// @route   PUT /api/ai-recommendations/:recommendationId/status
// @access  Private (Recommendation recipient)
export const updateRecommendationStatus = asyncHandler(async (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return next(new AppError("Validation failed", 400, errors.array()))
  }

  const recommendationId = req.params.recommendationId
  const { status, feedback } = req.body

  try {
    const recommendation = await aiRecommendationService.updateRecommendationStatus(
      recommendationId,
      req.user.id,
      status,
      feedback,
    )

    res.status(200).json({
      success: true,
      message: "Recommendation status updated successfully",
      data: { recommendation },
    })
  } catch (error) {
    return next(new AppError(error.message, 400))
  }
})

// @desc    Provide feedback on recommendation
// @route   POST /api/ai-recommendations/:recommendationId/feedback
// @access  Private (Recommendation recipient)
export const provideFeedback = asyncHandler(async (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return next(new AppError("Validation failed", 400, errors.array()))
  }

  const recommendationId = req.params.recommendationId
  const { rating, helpful, comments, implementationResult } = req.body

  try {
    const recommendation = await AIRecommendation.findOne({
      _id: recommendationId,
      user: req.user.id,
    })

    if (!recommendation) {
      return next(new AppError("Recommendation not found", 404))
    }

    recommendation.userFeedback = {
      rating: Number.parseInt(rating),
      helpful: helpful === "true" || helpful === true,
      comments: comments || "",
      implementationResult: implementationResult || "",
    }

    await recommendation.save()

    res.status(200).json({
      success: true,
      message: "Feedback provided successfully",
      data: { recommendation },
    })
  } catch (error) {
    return next(new AppError(`Failed to provide feedback: ${error.message}`, 500))
  }
})

// @desc    Get recommendation statistics
// @route   GET /api/farms/:farmId/ai-recommendations/stats
// @access  Private (Farm owner or org member)
export const getRecommendationStatistics = asyncHandler(async (req, res, next) => {
  const farmId = req.params.farmId
  const { period = "month" } = req.query

  // Check farm access
  const farm = await Farm.findById(farmId)
  if (!farm) {
    return next(new AppError("Farm not found", 404))
  }

  const isOwner = farm.owner.toString() === req.user.id
  const membership = await OrganizationMember.findOne({
    user: req.user.id,
    organization: farm.organization,
    status: "active",
  })

  if (!isOwner && !membership) {
    return next(new AppError("Access denied", 403))
  }

  try {
    let startDate
    const endDate = new Date()

    switch (period) {
      case "week":
        startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case "month":
        startDate = new Date(endDate.getFullYear(), endDate.getMonth() - 1, endDate.getDate())
        break
      case "year":
        startDate = new Date(endDate.getFullYear() - 1, endDate.getMonth(), endDate.getDate())
        break
      default:
        startDate = new Date(endDate.getFullYear(), endDate.getMonth() - 1, endDate.getDate())
    }

    const [
      totalRecommendations,
      implementedRecommendations,
      dismissedRecommendations,
      recommendationsByType,
      recommendationsByPriority,
      averageConfidence,
      feedbackStats,
      economicImpact,
    ] = await Promise.all([
      AIRecommendation.countDocuments({
        farm: farmId,
        user: req.user.id,
        createdAt: { $gte: startDate, $lte: endDate },
      }),
      AIRecommendation.countDocuments({
        farm: farmId,
        user: req.user.id,
        status: "implemented",
        createdAt: { $gte: startDate, $lte: endDate },
      }),
      AIRecommendation.countDocuments({
        farm: farmId,
        user: req.user.id,
        status: "dismissed",
        createdAt: { $gte: startDate, $lte: endDate },
      }),
      AIRecommendation.aggregate([
        {
          $match: {
            farm: farmId,
            user: req.user.id,
            createdAt: { $gte: startDate, $lte: endDate },
          },
        },
        {
          $group: {
            _id: "$type",
            count: { $sum: 1 },
          },
        },
      ]),
      AIRecommendation.aggregate([
        {
          $match: {
            farm: farmId,
            user: req.user.id,
            createdAt: { $gte: startDate, $lte: endDate },
          },
        },
        {
          $group: {
            _id: "$priority",
            count: { $sum: 1 },
          },
        },
      ]),
      AIRecommendation.aggregate([
        {
          $match: {
            farm: farmId,
            user: req.user.id,
            createdAt: { $gte: startDate, $lte: endDate },
          },
        },
        {
          $group: {
            _id: null,
            avgConfidence: { $avg: "$confidence" },
          },
        },
      ]),
      AIRecommendation.aggregate([
        {
          $match: {
            farm: farmId,
            user: req.user.id,
            "userFeedback.rating": { $exists: true },
            createdAt: { $gte: startDate, $lte: endDate },
          },
        },
        {
          $group: {
            _id: null,
            avgRating: { $avg: "$userFeedback.rating" },
            helpfulCount: {
              $sum: { $cond: [{ $eq: ["$userFeedback.helpful", true] }, 1, 0] },
            },
            totalFeedback: { $sum: 1 },
          },
        },
      ]),
      AIRecommendation.aggregate([
        {
          $match: {
            farm: farmId,
            user: req.user.id,
            status: "implemented",
            createdAt: { $gte: startDate, $lte: endDate },
          },
        },
        {
          $group: {
            _id: null,
            totalGain: { $sum: "$economicImpact.potentialGain" },
            totalSavings: { $sum: { $subtract: ["$economicImpact.potentialLoss", "$economicImpact.costOfAction"] } },
            totalCost: { $sum: "$economicImpact.costOfAction" },
          },
        },
      ]),
    ])

    const implementationRate =
      totalRecommendations > 0 ? Math.round((implementedRecommendations / totalRecommendations) * 100) : 0
    const dismissalRate =
      totalRecommendations > 0 ? Math.round((dismissedRecommendations / totalRecommendations) * 100) : 0

    res.status(200).json({
      success: true,
      data: {
        period,
        startDate,
        endDate,
        summary: {
          totalRecommendations,
          implementedRecommendations,
          dismissedRecommendations,
          implementationRate,
          dismissalRate,
          averageConfidence: averageConfidence[0]?.avgConfidence || 0,
        },
        breakdown: {
          byType: recommendationsByType,
          byPriority: recommendationsByPriority,
        },
        feedback: {
          averageRating: feedbackStats[0]?.avgRating || 0,
          helpfulPercentage:
            feedbackStats[0]?.totalFeedback > 0
              ? Math.round((feedbackStats[0].helpfulCount / feedbackStats[0].totalFeedback) * 100)
              : 0,
          totalFeedback: feedbackStats[0]?.totalFeedback || 0,
        },
        economicImpact: {
          totalGain: economicImpact[0]?.totalGain || 0,
          totalSavings: economicImpact[0]?.totalSavings || 0,
          totalCost: economicImpact[0]?.totalCost || 0,
          netBenefit:
            (economicImpact[0]?.totalGain || 0) +
            (economicImpact[0]?.totalSavings || 0) -
            (economicImpact[0]?.totalCost || 0),
        },
      },
    })
  } catch (error) {
    return next(new AppError(`Failed to fetch recommendation statistics: ${error.message}`, 500))
  }
})

// @desc    Generate market-based recommendations
// @route   POST /api/farms/:farmId/ai-recommendations/market
// @access  Private (Farm owner or org member)
export const generateMarketRecommendations = asyncHandler(async (req, res, next) => {
  const farmId = req.params.farmId

  // Check farm access
  const farm = await Farm.findById(farmId)
  if (!farm) {
    return next(new AppError("Farm not found", 404))
  }

  const isOwner = farm.owner.toString() === req.user.id
  const membership = await OrganizationMember.findOne({
    user: req.user.id,
    organization: farm.organization,
    status: "active",
  })

  if (!isOwner && !membership) {
    return next(new AppError("Access denied", 403))
  }

  try {
    const marketRecommendations = await aiRecommendationService.generateMarketRecommendations(farmId, req.user.id)

    res.status(200).json({
      success: true,
      message: "Market-based recommendations generated successfully",
      data: {
        recommendations: marketRecommendations,
        count: marketRecommendations.length,
      },
    })
  } catch (error) {
    return next(new AppError(`Failed to generate market recommendations: ${error.message}`, 500))
  }
})

export default {
  generateRecommendations,
  getRecommendations,
  getRecommendationDetails,
  updateRecommendationStatus,
  provideFeedback,
  getRecommendationStatistics,
  generateMarketRecommendations,
}
