import express from "express"
import cors from "cors"
import helmet from "helmet"
import compression from "compression"
import morgan from "morgan"
import mongoSanitize from "express-mongo-sanitize"
import xss from "xss-clean"
import hpp from "hpp"
import dotenv from "dotenv"
import passport from "passport"
import session from "express-session"
import cookieParser from "cookie-parser"
import path from "path"
import { fileURLToPath } from "url"

import authRoutes from "./routes/authRoutes.js"
import tokenRoutes from "./routes/tokenRoutes.js"
import organizationRoutes from "./routes/organizationRoutes.js"
import teamRoutes from "./routes/teamRoutes.js"
import roleRoutes from "./routes/roleRoutes.js"
import applicationRoutes from "./routes/applicationRoutes.js"
import apiTokenRoutes from "./routes/apiTokenRoutes.js"
import userRoutes from "./routes/userRoutes.js"

// Import agricultural routes
import weatherRoutes from "./routes/weatherRoutes.js"
import farmRoutes from "./routes/farmRoutes.js"
import cropRoutes from "./routes/cropRoutes.js"
import aiRecommendationRoutes from "./routes/aiRecommendationRoutes.js"
import dailyAssistantRoutes from "./routes/dailyAssistantRoutes.js"
import livestockRoutes from "./routes/livestockRoutes.js"
import aiStatusRoutes from "./routes/aiStatusRoutes.js"
import weatherAlertRoutes from "./routes/weatherAlertRoutes.js"

import { connectDB } from "./config/db.js"
import { configurePassport } from "./config/passport.js"
import { errorHandler, notFound } from "./middlewares/errorMiddleware.js"
import { apiRateLimit, authRateLimit, tokenRateLimit, orgCreationRateLimit } from "./middlewares/rateLimitMiddleware.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config()

const app = express()

const requiredEnvVars = ["MONGODB_URI", "JWT_SECRET", "JWT_REFRESH_SECRET", "OPENAI_API_KEY"]
const missingEnvVars = requiredEnvVars.filter((envVar) => !process.env[envVar])

if (missingEnvVars.length > 0) {
  console.error("❌ Missing required environment variables:", missingEnvVars.join(", "))
  console.error("💡 Required variables:")
  console.error("   - MONGODB_URI: MongoDB connection string")
  console.error("   - JWT_SECRET: Secret for JWT token signing")
  console.error("   - JWT_REFRESH_SECRET: Secret for refresh token signing")
  console.error("   - OPENAI_API_KEY: OpenAI API key for AI recommendations")
  process.exit(1)
}

connectDB()

if (process.env.NODE_ENV !== "test") {
  import("./utils/emailService.js").then(({ verifyEmailConfig }) => {
    verifyEmailConfig().then((isValid) => {
      if (isValid) {
        console.log("📧 Email service configured successfully")
      } else {
        console.warn("⚠️  Email service configuration failed - check your email settings")
        console.warn("💡 Email features will be disabled until properly configured")
      }
    })
  })
}

configurePassport()

if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1)
}

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
  }),
)

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true)

    const allowedOrigins = [
      process.env.CLIENT_URL || "http://localhost:3000",
      "http://localhost:3000",
      "http://localhost:3001",
      "https://clycites.com",
      "https://app.clycites.com",
    ]

    if (allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      callback(null, true)
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
}

app.use(cors(corsOptions))

app.use(cookieParser())

app.use(express.json({ limit: "10mb" }))
app.use(express.urlencoded({ extended: true, limit: "10mb" }))

app.use(mongoSanitize())

app.use(xss())

app.use(hpp())

app.use(compression())

// Logging
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"))
} else {
  app.use(morgan("combined"))
}

app.use(
  session({
    secret: process.env.SESSION_SECRET || "your-session-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
    },
  }),
)

app.use(passport.initialize())
app.use(passport.session())

app.use("/uploads", express.static("uploads"))

app.get("/favicon.ico", (req, res) => {
  res.status(204).end()
})

app.get("/health", (req, res) => {
  const aiConfigured = !!process.env.OPENAI_API_KEY

  res.status(200).json({
    status: "success",
    message: "ClyCites Agric Assistant API is running",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
    version: "2.0.0",
    database: "MongoDB Atlas",
    uptime: process.uptime(),
    services: {
      database: "connected",
      email: process.env.EMAIL_SERVICE ? "configured" : "not configured",
      ai: aiConfigured ? "configured" : "not configured",
      weather: "active",
    },
    features: [
      "Multi-Organization Support",
      "Role-Based Access Control",
      "API Token Management",
      "OAuth2 Applications",
      "Team Management",
      "Enterprise SSO",
      "Token Validation API",
      "Weather Integration",
      "AI-Powered Agricultural Recommendations",
      "Farm Management",
      "Crop Monitoring",
      "Smart Irrigation",
      "Precision Agriculture",
      "Weather Alerts & Notifications",
      "Daily Task Management",
      "Livestock Monitoring",
    ],
  })
})

// Update the API documentation endpoint to include AI status and new features
app.get("/api/docs", (req, res) => {
  const aiConfigured = !!process.env.OPENAI_API_KEY

  res.status(200).json({
    title: "ClyCites Agric Assistant API",
    version: "2.0.0",
    description: "Comprehensive agricultural intelligence system with AI-powered recommendations",
    baseUrl: `${req.protocol}://${req.get("host")}/api`,
    aiStatus: aiConfigured ? "configured" : "not configured",
    documentation: {
      postman: `${req.protocol}://${req.get("host")}/api/postman`,
      openapi: `${req.protocol}://${req.get("host")}/api/openapi`,
    },
    endpoints: {
      authentication: {
        "POST /api/auth/register": "Register new user",
        "POST /api/auth/login": "User login",
        "POST /api/auth/logout": "User logout (requires auth)",
        "GET /api/auth/me": "Get current user (requires auth)",
        "POST /api/auth/refresh-token": "Refresh access token",
        "GET /api/auth/verify-email/:token": "Verify email address",
        "POST /api/auth/forgot-password": "Request password reset",
        "PUT /api/auth/reset-password/:token": "Reset password",
        "PUT /api/auth/change-password": "Change password (requires auth)",
        "POST /api/auth/validate-token": "Validate JWT or API token",
        "GET /api/auth/token-info": "Get token information (requires auth)",
      },
      organizations: {
        "GET /api/organizations": "Get user organizations (requires auth)",
        "POST /api/organizations": "Create organization (requires auth)",
        "GET /api/organizations/:id": "Get organization details (requires auth)",
        "PUT /api/organizations/:id": "Update organization (requires auth)",
        "POST /api/organizations/:id/invite": "Invite user to organization (requires auth)",
        "GET /api/organizations/:id/members": "Get organization members (requires auth)",
      },
      teams: {
        "GET /api/organizations/:orgId/teams": "Get organization teams (requires auth)",
        "POST /api/organizations/:orgId/teams": "Create team (requires auth)",
        "POST /api/teams/:teamId/invite": "Invite user to team (requires auth)",
      },
      roles: {
        "GET /api/organizations/:orgId/roles": "Get organization roles (requires auth)",
        "POST /api/organizations/:orgId/roles": "Create role (requires auth)",
        "PUT /api/roles/:roleId": "Update role (requires auth)",
      },
      applications: {
        "GET /api/organizations/:orgId/applications": "Get organization applications (requires auth)",
        "POST /api/organizations/:orgId/applications": "Create application (requires auth)",
        "GET /api/applications/:appId": "Get application details (requires auth)",
        "POST /api/applications/:appId/regenerate-secret": "Regenerate client secret (requires auth)",
      },
      tokens: {
        "GET /api/organizations/:orgId/tokens": "Get user API tokens (requires auth)",
        "POST /api/organizations/:orgId/tokens": "Create API token (requires auth)",
        "DELETE /api/tokens/:tokenId": "Revoke API token (requires auth)",
      },
      users: {
        "GET /api/users": "Get all users (Super Admin only)",
        "GET /api/organizations/:orgId/users": "Get organization users (requires auth)",
        "PUT /api/users/:userId/global-role": "Update user global role (Super Admin only)",
        "PUT /api/users/:userId/deactivate": "Deactivate user account (Admin+)",
      },
      agriculture: {
        "GET /api/farms": "Get user farms (requires auth)",
        "POST /api/farms": "Create new farm (requires auth)",
        "GET /api/farms/:farmId": "Get farm details (requires auth)",
        "PUT /api/farms/:farmId": "Update farm (requires auth)",
        "GET /api/farms/:farmId/crops": "Get farm crops (requires auth)",
        "POST /api/farms/:farmId/crops": "Add crop to farm (requires auth)",
        "GET /api/weather/current/:location": "Get current weather",
        "GET /api/weather/forecast/:location": "Get weather forecast",
        "GET /api/recommendations/farm/:farmId": "Get AI recommendations for farm",
        "POST /api/recommendations/generate": "Generate new AI recommendation",
      },
      weatherAlerts: {
        "GET /api/farms/:farmId/weather-alerts": "Get farm weather alerts",
        "GET /api/weather-alerts/:alertId": "Get specific alert details",
        "PUT /api/weather-alerts/:alertId/acknowledge": "Acknowledge weather alert",
        "POST /api/weather-alerts/:alertId/implement-action": "Record action taken on alert",
        "POST /api/weather-alerts/:alertId/create-tasks": "Create tasks from alert recommendations",
        "GET /api/farms/:farmId/weather-alerts/stats": "Get alert statistics for farm",
        "POST /api/weather-alerts/expire-old": "System maintenance - expire old alerts",
      },
      dailyAssistant: {
        "GET /api/daily-assistant/tasks/:farmId": "Get daily tasks for farm",
        "POST /api/daily-assistant/tasks": "Create new daily task",
        "PUT /api/daily-assistant/tasks/:taskId": "Update task status",
        "GET /api/daily-assistant/summary/:farmId": "Get daily farm summary",
      },
      livestock: {
        "GET /api/farms/:farmId/livestock": "Get farm livestock",
        "POST /api/farms/:farmId/livestock": "Add livestock to farm",
        "GET /api/livestock/:livestockId": "Get livestock details",
        "PUT /api/livestock/:livestockId": "Update livestock information",
      },
      aiService: {
        "GET /api/ai/status": "Check AI service configuration status",
        "POST /api/ai/test": "Test AI service connectivity (requires auth)",
      },
    },
    authentication: {
      methods: ["JWT Bearer Token", "API Key", "OAuth2", "Session Cookies"],
      tokenFormat: "Bearer <token>",
      scopes: [
        "profile",
        "email",
        "organizations",
        "teams",
        "users",
        "roles",
        "permissions",
        "applications",
        "analytics",
        "billing",
        "admin",
        "agriculture",
        "weather",
        "ai-recommendations",
      ],
    },
    setup: {
      requiredEnvVars: [
        "MONGODB_URI - MongoDB connection string",
        "JWT_SECRET - JWT token signing secret",
        "JWT_REFRESH_SECRET - Refresh token signing secret",
        "OPENAI_API_KEY - OpenAI API key for AI features",
      ],
      optionalEnvVars: [
        "EMAIL_SERVICE - Email service configuration",
        "CLIENT_URL - Frontend application URL",
        "WEATHER_API_KEY - Weather service API key",
        "TWILIO_ACCOUNT_SID - Twilio account for SMS notifications",
        "TWILIO_AUTH_TOKEN - Twilio authentication token",
        "TWILIO_PHONE_NUMBER - Twilio phone number for SMS",
      ],
    },
    examples: {
      login: {
        url: "POST /api/auth/login",
        body: {
          identifier: "user@example.com",
          password: "password123",
        },
      },
      register: {
        url: "POST /api/auth/register",
        body: {
          username: "johndoe",
          email: "john@example.com",
          password: "Password123!",
          firstName: "John",
          lastName: "Doe",
        },
      },
      validateToken: {
        url: "POST /api/auth/validate-token",
        headers: {
          Authorization: "Bearer <your-jwt-token>",
          "x-api-key": "<your-api-key>",
        },
        body: {
          token: "<token-to-validate>",
        },
      },
    },
  })
})

app.use("/api", apiRateLimit)
app.use("/api/auth/login", authRateLimit)
app.use("/api/auth/register", authRateLimit)
app.use("/api/*/tokens", tokenRateLimit)
app.use("/api/organizations", orgCreationRateLimit)

app.use("/api/auth", authRoutes)
app.use("/api/auth", tokenRoutes)
app.use("/api/organizations", organizationRoutes)
app.use("/api", teamRoutes)
app.use("/api", roleRoutes)
app.use("/api", applicationRoutes)
app.use("/api", apiTokenRoutes)
app.use("/api/users", userRoutes)

// Agricultural routes
app.use("/api/weather", weatherRoutes)
app.use("/api", farmRoutes)
app.use("/api", cropRoutes)
app.use("/api/recommendations", aiRecommendationRoutes)
app.use("/api", dailyAssistantRoutes)
app.use("/api", livestockRoutes)
app.use("/api", aiStatusRoutes)
app.use("/api", weatherAlertRoutes)

app.get("/api/status", (req, res) => {
  const aiConfigured = !!process.env.OPENAI_API_KEY

  res.status(200).json({
    status: "operational",
    timestamp: new Date().toISOString(),
    services: {
      database: "connected",
      email: process.env.EMAIL_SERVICE ? "configured" : "not configured",
      authentication: "active",
      tokenValidation: "active",
      ai: aiConfigured ? "configured" : "not configured",
      weather: "active",
      notifications: "active",
    },
  })
})

app.get("/api/postman", (req, res) => {
  res.status(200).json({
    info: {
      name: "ClyCites Agric Assistant API",
      description: "ClyCites Agricultural Intelligence API Collection",
      version: "2.0.0",
      schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
    },
    auth: {
      type: "bearer",
      bearer: [
        {
          key: "token",
          value: "{{access_token}}",
          type: "string",
        },
      ],
    },
    variable: [
      {
        key: "base_url",
        value: `${req.protocol}://${req.get("host")}`,
        type: "string",
      },
      {
        key: "access_token",
        value: "",
        type: "string",
      },
    ],
    item: [
      {
        name: "Authentication",
        item: [
          {
            name: "Login",
            request: {
              method: "POST",
              header: [
                {
                  key: "Content-Type",
                  value: "application/json",
                },
              ],
              body: {
                mode: "raw",
                raw: JSON.stringify({
                  identifier: "admin@clycites.com",
                  password: "SuperAdmin123!",
                }),
              },
              url: {
                raw: "{{base_url}}/api/auth/login",
                host: ["{{base_url}}"],
                path: ["api", "auth", "login"],
              },
            },
          },
          {
            name: "Validate Token",
            request: {
              method: "POST",
              header: [
                {
                  key: "Content-Type",
                  value: "application/json",
                },
                {
                  key: "Authorization",
                  value: "Bearer {{access_token}}",
                },
              ],
              body: {
                mode: "raw",
                raw: JSON.stringify({
                  token: "{{access_token}}",
                }),
              },
              url: {
                raw: "{{base_url}}/api/auth/validate-token",
                host: ["{{base_url}}"],
                path: ["api", "auth", "validate-token"],
              },
            },
          },
          {
            name: "Get Current User",
            request: {
              method: "GET",
              header: [
                {
                  key: "Authorization",
                  value: "Bearer {{access_token}}",
                },
              ],
              url: {
                raw: "{{base_url}}/api/auth/me",
                host: ["{{base_url}}"],
                path: ["api", "auth", "me"],
              },
            },
          },
        ],
      },
      {
        name: "Weather Alerts",
        item: [
          {
            name: "Get Farm Weather Alerts",
            request: {
              method: "GET",
              header: [
                {
                  key: "Authorization",
                  value: "Bearer {{access_token}}",
                },
              ],
              url: {
                raw: "{{base_url}}/api/farms/:farmId/weather-alerts",
                host: ["{{base_url}}"],
                path: ["api", "farms", ":farmId", "weather-alerts"],
              },
            },
          },
          {
            name: "Acknowledge Weather Alert",
            request: {
              method: "PUT",
              header: [
                {
                  key: "Authorization",
                  value: "Bearer {{access_token}}",
                },
                {
                  key: "Content-Type",
                  value: "application/json",
                },
              ],
              body: {
                mode: "raw",
                raw: JSON.stringify({
                  acknowledgedBy: "Farm Manager",
                  notes: "Alert reviewed and action plan prepared",
                }),
              },
              url: {
                raw: "{{base_url}}/api/weather-alerts/:alertId/acknowledge",
                host: ["{{base_url}}"],
                path: ["api", "weather-alerts", ":alertId", "acknowledge"],
              },
            },
          },
        ],
      },
    ],
  })
})

app.get("/", (req, res) => {
  res.status(200).json({
    message: "🚀 ClyCites Agric Assistant API",
    version: "2.0.0",
    documentation: `${req.protocol}://${req.get("host")}/api/docs`,
    health: `${req.protocol}://${req.get("host")}/health`,
    status: "operational",
    features: [
      "Multi-Organization Support",
      "Role-Based Access Control",
      "API Token Management",
      "OAuth2 Applications",
      "Team Management",
      "Enterprise SSO",
      "Token Validation API",
      "Weather Integration",
      "AI-Powered Agricultural Recommendations",
      "Farm Management",
      "Crop Monitoring",
      "Smart Irrigation",
      "Precision Agriculture",
      "Weather Alerts & Notifications",
      "Daily Task Management",
      "Livestock Monitoring",
    ],
  })
})

app.use(notFound)
app.use(errorHandler)

const PORT = process.env.PORT || 5000

const server = app.listen(PORT, () => {
  console.log(`🚀 ClyCites Agric Assistant API running on port ${PORT}`)
  console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`)
  console.log(`🔗 Database: MongoDB Atlas`)
  console.log(`📚 API Documentation: http://localhost:${PORT}/api/docs`)
  console.log(`🏥 Health check: http://localhost:${PORT}/health`)
  console.log(`🔐 Token validation: http://localhost:${PORT}/api/auth/validate-token`)
  console.log(`📧 Email service: ${process.env.EMAIL_SERVICE || "Not configured"}`)
  console.log(`🤖 AI service: ${process.env.OPENAI_API_KEY ? "Configured" : "Not configured"}`)
  console.log(`🌦️  Weather alerts: Active`)
  console.log(`🔐 Ready to accept requests!`)
})

process.on("unhandledRejection", (err, promise) => {
  console.log(`❌ Unhandled Promise Rejection: ${err.message}`)
  server.close(() => {
    process.exit(1)
  })
})

process.on("uncaughtException", (err) => {
  console.log(`❌ Uncaught Exception: ${err.message}`)
  process.exit(1)
})

export default app
