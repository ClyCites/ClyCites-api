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

import { connectDB } from "./config/db.js"
import { configurePassport } from "./config/passport.js"
import { errorHandler, notFound } from "./middlewares/errorMiddleware.js"
import { apiRateLimit, authRateLimit, tokenRateLimit, orgCreationRateLimit } from "./middlewares/rateLimitMiddleware.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config()

const app = express()

const requiredEnvVars = ["MONGODB_URI", "JWT_SECRET", "JWT_REFRESH_SECRET"]
const missingEnvVars = requiredEnvVars.filter((envVar) => !process.env[envVar])

if (missingEnvVars.length > 0) {
  console.error("❌ Missing required environment variables:", missingEnvVars.join(", "))
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

// Trust proxy for cloud deployment
if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1)
}

// Security middleware
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

// CORS configuration
const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, etc.)
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
      callback(null, true) // Allow all origins in development
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
}

app.use(cors(corsOptions))

// Cookie parser middleware
app.use(cookieParser())

// Body parsing middleware
app.use(express.json({ limit: "10mb" }))
app.use(express.urlencoded({ extended: true, limit: "10mb" }))

// Data sanitization against NoSQL query injection
app.use(mongoSanitize())

// Data sanitization against XSS
app.use(xss())

// Prevent parameter pollution
app.use(hpp())

// Compression middleware
app.use(compression())

// Logging
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"))
} else {
  app.use(morgan("combined"))
}

// Session configuration for Passport
app.use(
  session({
    secret: process.env.SESSION_SECRET || "your-session-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  }),
)

// Passport middleware
app.use(passport.initialize())
app.use(passport.session())

// Static files for profile pictures
app.use("/uploads", express.static("uploads"))

// Favicon route to prevent 404 errors
app.get("/favicon.ico", (req, res) => {
  res.status(204).end()
})

// Public routes (no authentication required)
// Health check endpoint - MUST be before rate limiting and auth
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "success",
    message: "ClyCites Enterprise Auth Server is running",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
    version: "2.0.0",
    database: "MongoDB Atlas",
    uptime: process.uptime(),
    features: [
      "Multi-Organization Support",
      "Role-Based Access Control",
      "API Token Management",
      "OAuth2 Applications",
      "Team Management",
      "Enterprise SSO",
      "Token Validation API",
    ],
  })
})

// API documentation endpoint - public access
app.get("/api/docs", (req, res) => {
  res.status(200).json({
    title: "ClyCites Enterprise Authentication API",
    version: "2.0.0",
    description: "Comprehensive authentication and authorization system for ClyCites platform",
    baseUrl: `${req.protocol}://${req.get("host")}/api`,
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

// Rate limiting - apply after public routes
app.use("/api", apiRateLimit)
app.use("/api/auth/login", authRateLimit)
app.use("/api/auth/register", authRateLimit)
app.use("/api/*/tokens", tokenRateLimit)
app.use("/api/organizations", orgCreationRateLimit)

// API routes
app.use("/api/auth", authRoutes)
app.use("/api/auth", tokenRoutes) // Add token validation routes
app.use("/api/organizations", organizationRoutes)
app.use("/api", teamRoutes)
app.use("/api", roleRoutes)
app.use("/api", applicationRoutes)
app.use("/api", apiTokenRoutes)
app.use("/api/users", userRoutes)

// Additional public endpoints
app.get("/api/status", (req, res) => {
  res.status(200).json({
    status: "operational",
    timestamp: new Date().toISOString(),
    services: {
      database: "connected",
      email: "configured",
      authentication: "active",
      tokenValidation: "active",
    },
  })
})

// Postman collection endpoint
app.get("/api/postman", (req, res) => {
  res.status(200).json({
    info: {
      name: "ClyCites Auth API",
      description: "ClyCites Enterprise Authentication API Collection",
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
    ],
  })
})

// Root endpoint
app.get("/", (req, res) => {
  res.status(200).json({
    message: "🚀 ClyCites Enterprise Authentication Server",
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
    ],
  })
})

// Error handling middleware - MUST be last
app.use(notFound)
app.use(errorHandler)

const PORT = process.env.PORT || 5000

const server = app.listen(PORT, () => {
  console.log(`🚀 ClyCites Enterprise Auth Server running on port ${PORT}`)
  console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`)
  console.log(`🔗 Database: MongoDB Atlas`)
  console.log(`📚 API Documentation: http://localhost:${PORT}/api/docs`)
  console.log(`🏥 Health check: http://localhost:${PORT}/health`)
  console.log(`🔐 Token validation: http://localhost:${PORT}/api/auth/validate-token`)
  console.log(`📧 Email service: ${process.env.EMAIL_SERVICE || "Not configured"}`)
  console.log(`🔐 Ready to accept requests!`)
})

// Handle unhandled promise rejections
process.on("unhandledRejection", (err, promise) => {
  console.log(`❌ Unhandled Promise Rejection: ${err.message}`)
  server.close(() => {
    process.exit(1)
  })
})

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
  console.log(`❌ Uncaught Exception: ${err.message}`)
  process.exit(1)
})

export default app
