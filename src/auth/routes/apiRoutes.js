import express from "express"
import { authenticateApiToken, requireScope, checkApiTokenRateLimit } from "../middlewares/apiAuthMiddleware.js"
import { asyncHandler } from "../utils/asyncHandler.js"

const router = express.Router()

// Apply API token authentication and rate limiting to all API routes
router.use(authenticateApiToken)
router.use(checkApiTokenRateLimit)

// @desc    Test API endpoint
// @route   GET /api/v1/test
// @access  API Token (read scope)
router.get(
  "/test",
  requireScope("read"),
  asyncHandler(async (req, res) => {
    res.status(200).json({
      success: true,
      message: "API token authentication successful",
      data: {
        user: {
          id: req.user._id,
          username: req.user.username,
          email: req.user.email,
        },
        organization: {
          id: req.organization._id,
          name: req.organization.name,
          slug: req.organization.slug,
        },
        token: {
          name: req.apiToken.name,
          scopes: req.apiToken.scopes,
          rateLimits: req.apiToken.rateLimits,
        },
        timestamp: new Date().toISOString(),
      },
    })
  }),
)

// @desc    Get user profile via API
// @route   GET /api/v1/profile
// @access  API Token (profile scope)
router.get(
  "/profile",
  requireScope("profile"),
  asyncHandler(async (req, res) => {
    res.status(200).json({
      success: true,
      data: {
        user: {
          id: req.user._id,
          username: req.user.username,
          email: req.user.email,
          firstName: req.user.firstName,
          lastName: req.user.lastName,
          fullName: req.user.fullName,
          profilePicture: req.user.profilePicture,
          isEmailVerified: req.user.isEmailVerified,
          lastLogin: req.user.lastLogin,
          createdAt: req.user.createdAt,
        },
      },
    })
  }),
)

// @desc    Get organization info via API
// @route   GET /api/v1/organization
// @access  API Token (organizations scope)
router.get(
  "/organization",
  requireScope("organizations"),
  asyncHandler(async (req, res) => {
    res.status(200).json({
      success: true,
      data: {
        organization: {
          id: req.organization._id,
          name: req.organization.name,
          slug: req.organization.slug,
          description: req.organization.description,
          industry: req.organization.industry,
          size: req.organization.size,
          subscription: req.organization.subscription,
          createdAt: req.organization.createdAt,
        },
      },
    })
  }),
)

export default router
