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

// Import routes
import authRoutes from "./routes/authRoutes.js"
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

// Load environment variables
dotenv.config()

const app = express()

// Connect to database
connectDB()

// Verify email configuration on startup
if (process.env.NODE_ENV !== "test") {
  import("./utils/emailService.js").then(({ verifyEmailConfig }) => {
    verifyEmailConfig().then((isValid) => {
      if (isValid) {
        console.log("📧 Email service configured successfully")
      } else {
        console.warn("⚠️  Email service configuration failed - check your email settings")
      }
    })
  })
}

// Configure Passport
configurePassport()

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

// Rate limiting
app.use("/api", apiRateLimit)
app.use("/api/auth/login", authRateLimit)
app.use("/api/auth/register", authRateLimit)
app.use("/api/*/tokens", tokenRateLimit)
app.use("/api/organizations", orgCreationRateLimit)

// CORS configuration
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true,
    optionsSuccessStatus: 200,
  }),
)

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

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "success",
    message: "ClyCites Enterprise Auth Server is running",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
    version: "2.0.0",
    features: [
      "Multi-Organization Support",
      "Role-Based Access Control",
      "API Token Management",
      "OAuth2 Applications",
      "Team Management",
      "Enterprise SSO",
    ],
  })
})

// API routes
app.use("/api/auth", authRoutes)
app.use("/api/organizations", organizationRoutes)
app.use("/api", teamRoutes)
app.use("/api", roleRoutes)
app.use("/api", applicationRoutes)
app.use("/api", apiTokenRoutes)
app.use("/api/users", userRoutes)

// API documentation endpoint
app.get("/api/docs", (req, res) => {
  res.status(200).json({
    title: "ClyCites Enterprise Authentication API",
    version: "2.0.0",
    description: "Comprehensive authentication and authorization system for ClyCites platform",
    endpoints: {
      authentication: {
        "POST /api/auth/register": "Register new user",
        "POST /api/auth/login": "User login",
        "POST /api/auth/logout": "User logout",
        "GET /api/auth/me": "Get current user",
        "POST /api/auth/refresh-token": "Refresh access token",
      },
      organizations: {
        "GET /api/organizations": "Get user organizations",
        "POST /api/organizations": "Create organization",
        "GET /api/organizations/:id": "Get organization details",
        "PUT /api/organizations/:id": "Update organization",
        "POST /api/organizations/:id/invite": "Invite user to organization",
        "GET /api/organizations/:id/members": "Get organization members",
      },
      teams: {
        "GET /api/organizations/:orgId/teams": "Get organization teams",
        "POST /api/organizations/:orgId/teams": "Create team",
        "POST /api/teams/:teamId/invite": "Invite user to team",
      },
      roles: {
        "GET /api/organizations/:orgId/roles": "Get organization roles",
        "POST /api/organizations/:orgId/roles": "Create role",
        "PUT /api/roles/:roleId": "Update role",
      },
      applications: {
        "GET /api/organizations/:orgId/applications": "Get organization applications",
        "POST /api/organizations/:orgId/applications": "Create application",
        "GET /api/applications/:appId": "Get application details",
        "POST /api/applications/:appId/regenerate-secret": "Regenerate client secret",
      },
      tokens: {
        "GET /api/organizations/:orgId/tokens": "Get user API tokens",
        "POST /api/organizations/:orgId/tokens": "Create API token",
        "DELETE /api/tokens/:tokenId": "Revoke API token",
      },
      users: {
        "GET /api/users": "Get all users (Super Admin)",
        "GET /api/organizations/:orgId/users": "Get organization users",
        "PUT /api/users/:userId/global-role": "Update user global role",
        "PUT /api/users/:userId/deactivate": "Deactivate user account",
      },
    },
    authentication: {
      methods: ["JWT Bearer Token", "API Key", "OAuth2"],
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
  })
})

// Error handling middleware
app.use(notFound)
app.use(errorHandler)

const PORT = process.env.PORT || 5000

const server = app.listen(PORT, () => {
  console.log(
    `🚀 ClyCites Enterprise Auth Server running on port ${PORT} in ${process.env.NODE_ENV || "development"} mode`,
  )
  console.log(`📚 API Documentation available at: http://localhost:${PORT}/api/docs`)
  console.log(`🏥 Health check available at: http://localhost:${PORT}/health`)
})

// Handle unhandled promise rejections
process.on("unhandledRejection", (err, promise) => {
  console.log(`Error: ${err.message}`)
  server.close(() => {
    process.exit(1)
  })
})

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
  console.log(`Error: ${err.message}`)
  process.exit(1)
})

export default app
