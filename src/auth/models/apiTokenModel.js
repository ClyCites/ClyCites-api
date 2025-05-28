import mongoose from "mongoose"
import crypto from "crypto"

const apiTokenSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Token name is required"],
      trim: true,
      maxlength: [100, "Token name cannot exceed 100 characters"],
    },
    description: {
      type: String,
      maxlength: [500, "Description cannot exceed 500 characters"],
    },
    token: {
      type: String,
      unique: true,
      required: true,
      select: false,
    },
    hashedToken: {
      type: String,
      unique: true,
      required: true,
    },
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    application: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Application",
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
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
          "invite",
          "export",
          "import",
        ],
      },
    ],
    permissions: [
      {
        resource: String,
        actions: [String],
      },
    ],
    rateLimits: {
      requestsPerMinute: { type: Number, default: 60 },
      requestsPerHour: { type: Number, default: 1000 },
      requestsPerDay: { type: Number, default: 10000 },
    },
    usage: {
      totalRequests: { type: Number, default: 0 },
      lastUsedAt: Date,
      lastUsedIP: String,
      lastUsedUserAgent: String,
    },
    restrictions: {
      allowedIPs: [String],
      allowedDomains: [String],
      allowedUserAgents: [String],
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
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
apiTokenSchema.index({ hashedToken: 1 })
apiTokenSchema.index({ organization: 1 })
apiTokenSchema.index({ user: 1 })
apiTokenSchema.index({ application: 1 })
apiTokenSchema.index({ expiresAt: 1 })
apiTokenSchema.index({ isActive: 1 })

// Pre-save middleware to generate token
apiTokenSchema.pre("save", function (next) {
  if (this.isNew && !this.token) {
    const token = `clycites_${crypto.randomBytes(32).toString("hex")}`
    this.token = token
    this.hashedToken = crypto.createHash("sha256").update(token).digest("hex")
  }
  next()
})

// Method to verify token
apiTokenSchema.statics.verifyToken = async function (token) {
  const hashedToken = crypto.createHash("sha256").update(token).digest("hex")

  const apiToken = await this.findOne({
    hashedToken,
    isActive: true,
    expiresAt: { $gt: new Date() },
  }).populate("user organization application")

  if (!apiToken) {
    return null
  }

  // Update usage statistics
  apiToken.usage.totalRequests += 1
  apiToken.usage.lastUsedAt = new Date()
  await apiToken.save()

  return apiToken
}

// Method to check if token has scope
apiTokenSchema.methods.hasScope = function (scope) {
  return this.scopes.includes(scope)
}

// Method to check if token has permission
apiTokenSchema.methods.hasPermission = function (resource, action) {
  const permission = this.permissions.find((p) => p.resource === resource)
  return permission && permission.actions.includes(action)
}

const ApiToken = mongoose.model("ApiToken", apiTokenSchema)

export default ApiToken
