import mongoose from "mongoose"
import crypto from "crypto"

const applicationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Application name is required"],
      trim: true,
      maxlength: [100, "Application name cannot exceed 100 characters"],
    },
    description: {
      type: String,
      maxlength: [500, "Description cannot exceed 500 characters"],
    },
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    type: {
      type: String,
      enum: ["web", "mobile", "desktop", "api", "service", "integration"],
      required: true,
    },
    platform: {
      type: String,
      enum: ["web", "ios", "android", "windows", "macos", "linux", "cross-platform"],
      default: "web",
    },
    clientId: {
      type: String,
      unique: true,
      required: true,
    },
    clientSecret: {
      type: String,
      required: true,
      select: false,
    },
    redirectUris: [
      {
        type: String,
        validate: {
          validator: (v) => /^https?:\/\/.+/.test(v),
          message: "Redirect URI must be a valid URL",
        },
      },
    ],
    allowedOrigins: [
      {
        type: String,
      },
    ],
    scopes: [
      {
        type: String,
        enum: [
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
          "read",
          "write",
          "delete",
        ],
      },
    ],
    grantTypes: [
      {
        type: String,
        enum: ["authorization_code", "client_credentials", "refresh_token", "implicit"],
        default: "authorization_code",
      },
    ],
    tokenSettings: {
      accessTokenTTL: { type: Number, default: 3600 }, // seconds
      refreshTokenTTL: { type: Number, default: 2592000 }, // 30 days
      allowRefreshToken: { type: Boolean, default: true },
      reuseRefreshToken: { type: Boolean, default: false },
    },
    rateLimits: {
      requestsPerMinute: { type: Number, default: 100 },
      requestsPerHour: { type: Number, default: 1000 },
      requestsPerDay: { type: Number, default: 10000 },
    },
    webhooks: [
      {
        url: String,
        events: [String],
        secret: String,
        isActive: { type: Boolean, default: true },
      },
    ],
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  },
)

// Indexes
applicationSchema.index({ organization: 1 })
applicationSchema.index({ clientId: 1 })
applicationSchema.index({ type: 1, platform: 1 })

// Pre-save middleware to generate client credentials
applicationSchema.pre("save", function (next) {
  if (this.isNew) {
    this.clientId = `clycites_${crypto.randomBytes(16).toString("hex")}`
    this.clientSecret = crypto.randomBytes(32).toString("hex")
  }
  next()
})

// Method to verify client secret
applicationSchema.methods.verifySecret = function (secret) {
  return this.clientSecret === secret
}

// Method to check if scope is allowed
applicationSchema.methods.hasScope = function (scope) {
  return this.scopes.includes(scope)
}

// Method to check rate limits
applicationSchema.methods.checkRateLimit = function (timeframe, currentCount) {
  const limits = {
    minute: this.rateLimits.requestsPerMinute,
    hour: this.rateLimits.requestsPerHour,
    day: this.rateLimits.requestsPerDay,
  }

  return currentCount < limits[timeframe]
}

const Application = mongoose.model("Application", applicationSchema)

export default Application
