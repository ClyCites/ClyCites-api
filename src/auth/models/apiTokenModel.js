import mongoose from "mongoose"
import crypto from "crypto"

const apiTokenSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Token name is required"],
      trim: true,
      minlength: [2, "Token name must be at least 2 characters long"],
      maxlength: [100, "Token name cannot exceed 100 characters"],
      validate: {
        validator: (v) => v && v.trim().length > 0,
        message: "Token name cannot be empty",
      },
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
      default: "",
    },
    token: {
      type: String,
      unique: true,
      required: [true, "Token value is required"],
      select: false,
      validate: {
        validator: (v) => v && v.startsWith("clycites_") && v.length > 20,
        message: "Invalid token format",
      },
    },
    hashedToken: {
      type: String,
      unique: true,
      required: [true, "Hashed token is required"],
      validate: {
        validator: (v) => {
          return v && v.length === 64 // SHA256 hash length
        },
        message: "Invalid hashed token format",
      },
    },
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: [true, "Organization is required"],
      validate: {
        validator: (v) => mongoose.Types.ObjectId.isValid(v),
        message: "Invalid organization ID",
      },
    },
    application: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Application",
      default: null,
      validate: {
        validator: (v) => v === null || mongoose.Types.ObjectId.isValid(v),
        message: "Invalid application ID",
      },
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User is required"],
      validate: {
        validator: (v) => mongoose.Types.ObjectId.isValid(v),
        message: "Invalid user ID",
      },
    },
    scopes: {
      type: [String],
      required: [true, "At least one scope is required"],
      validate: {
        validator: (v) => {
          const validScopes = [
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
            "manage",
          ]
          return Array.isArray(v) && v.length > 0 && v.every((scope) => validScopes.includes(scope))
        },
        message: "Invalid scopes provided",
      },
    },
    permissions: {
      type: [
        {
          resource: {
            type: String,
            required: true,
            trim: true,
          },
          actions: {
            type: [String],
            required: true,
            validate: {
              validator: (v) => {
                const validActions = [
                  "create",
                  "read",
                  "update",
                  "delete",
                  "manage",
                  "invite",
                  "approve",
                  "export",
                  "import",
                ]
                return Array.isArray(v) && v.length > 0 && v.every((action) => validActions.includes(action))
              },
              message: "Invalid actions provided",
            },
          },
        },
      ],
      default: [],
    },
    rateLimits: {
      requestsPerMinute: {
        type: Number,
        default: 60,
        min: [1, "Requests per minute must be at least 1"],
        max: [10000, "Requests per minute cannot exceed 10000"],
      },
      requestsPerHour: {
        type: Number,
        default: 1000,
        min: [1, "Requests per hour must be at least 1"],
        max: [100000, "Requests per hour cannot exceed 100000"],
      },
      requestsPerDay: {
        type: Number,
        default: 10000,
        min: [1, "Requests per day must be at least 1"],
        max: [1000000, "Requests per day cannot exceed 1000000"],
      },
    },
    usage: {
      totalRequests: {
        type: Number,
        default: 0,
        min: [0, "Total requests cannot be negative"],
      },
      lastUsedAt: {
        type: Date,
        default: null,
      },
      lastUsedIP: {
        type: String,
        default: null,
        validate: {
          validator: (v) => {
            if (!v) return true
            // Basic IP validation (IPv4 and IPv6)
            const ipv4Regex =
              /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/
            const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/
            return ipv4Regex.test(v) || ipv6Regex.test(v)
          },
          message: "Invalid IP address format",
        },
      },
      lastUsedUserAgent: {
        type: String,
        default: null,
        maxlength: [500, "User agent cannot exceed 500 characters"],
      },
    },
    restrictions: {
      allowedIPs: {
        type: [String],
        default: [],
        validate: {
          validator: (v) => {
            if (!Array.isArray(v)) return false
            const ipv4Regex =
              /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/
            return v.every((ip) => ipv4Regex.test(ip))
          },
          message: "Invalid IP addresses in allowedIPs",
        },
      },
      allowedDomains: {
        type: [String],
        default: [],
        validate: {
          validator: (v) => {
            if (!Array.isArray(v)) return false
            const domainRegex =
              /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/
            return v.every((domain) => domainRegex.test(domain))
          },
          message: "Invalid domains in allowedDomains",
        },
      },
      allowedUserAgents: {
        type: [String],
        default: [],
      },
    },
    expiresAt: {
      type: Date,
      required: [true, "Expiration date is required"],
      validate: {
        validator: (v) => v && v > new Date(),
        message: "Expiration date must be in the future",
      },
      default: () => new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Creator is required"],
      validate: {
        validator: (v) => mongoose.Types.ObjectId.isValid(v),
        message: "Invalid creator ID",
      },
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        // Remove sensitive fields from JSON output
        delete ret.token
        delete ret.hashedToken
        delete ret.__v
        return ret
      },
    },
    toObject: {
      virtuals: true,
      transform: (doc, ret) => {
        // Remove sensitive fields from object output
        delete ret.token
        delete ret.hashedToken
        delete ret.__v
        return ret
      },
    },
  },
)

// Indexes for performance and uniqueness
apiTokenSchema.index({ hashedToken: 1 }, { unique: true })
apiTokenSchema.index({ organization: 1, user: 1 })
apiTokenSchema.index({ user: 1 })
apiTokenSchema.index({ application: 1 })
apiTokenSchema.index({ expiresAt: 1 })
apiTokenSchema.index({ isActive: 1 })
apiTokenSchema.index({ createdAt: -1 })
apiTokenSchema.index({ "usage.lastUsedAt": -1 })

// Compound index for efficient queries
apiTokenSchema.index({ organization: 1, isActive: 1, expiresAt: 1 })

// Virtual for checking if token is expired
apiTokenSchema.virtual("isExpired").get(function () {
  return this.expiresAt < new Date()
})

// Virtual for checking if token is valid (active and not expired)
apiTokenSchema.virtual("isValid").get(function () {
  return this.isActive && !this.isExpired
})

// Virtual for days until expiry
apiTokenSchema.virtual("daysUntilExpiry").get(function () {
  if (this.isExpired) return 0
  return Math.ceil((this.expiresAt - new Date()) / (1000 * 60 * 60 * 24))
})

// Pre-save middleware to generate token and hash
apiTokenSchema.pre("save", function (next) {
  if (this.isNew && !this.token) {
    try {
      const token = `clycites_${crypto.randomBytes(32).toString("hex")}`
      this.token = token
      this.hashedToken = crypto.createHash("sha256").update(token).digest("hex")
    } catch (error) {
      return next(new Error("Failed to generate token"))
    }
  }
  next()
})

// Pre-save middleware to validate rate limits consistency
apiTokenSchema.pre("save", function (next) {
  if (this.rateLimits) {
    const { requestsPerMinute, requestsPerHour, requestsPerDay } = this.rateLimits

    // Ensure rate limits are logically consistent
    if (requestsPerHour < requestsPerMinute) {
      return next(new Error("Requests per hour cannot be less than requests per minute"))
    }

    if (requestsPerDay < requestsPerHour) {
      return next(new Error("Requests per day cannot be less than requests per hour"))
    }
  }
  next()
})

// Static method to verify and validate token
apiTokenSchema.statics.verifyToken = async function (token) {
  try {
    if (!token || typeof token !== "string") {
      throw new Error("Invalid token format")
    }

    if (!token.startsWith("clycites_")) {
      throw new Error("Invalid token prefix")
    }

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex")

    const apiToken = await this.findOne({
      hashedToken,
      isActive: true,
      expiresAt: { $gt: new Date() },
    }).populate("user organization application")

    if (!apiToken) {
      throw new Error("Token not found or expired")
    }

    // Check if organization is active
    if (!apiToken.organization.isActive) {
      throw new Error("Organization is inactive")
    }

    // Check if user is active
    if (!apiToken.user.isActive) {
      throw new Error("User account is inactive")
    }

    // Update usage statistics
    apiToken.usage.totalRequests += 1
    apiToken.usage.lastUsedAt = new Date()
    await apiToken.save()

    return apiToken
  } catch (error) {
    throw new Error(`Token verification failed: ${error.message}`)
  }
}

// Instance method to check if token has specific scope
apiTokenSchema.methods.hasScope = function (scope) {
  return this.scopes && this.scopes.includes(scope)
}

// Instance method to check if token has multiple scopes
apiTokenSchema.methods.hasScopes = function (scopes) {
  if (!Array.isArray(scopes)) return false
  return scopes.every((scope) => this.hasScope(scope))
}

// Instance method to check if token has permission for resource and action
apiTokenSchema.methods.hasPermission = function (resource, action) {
  if (!this.permissions || !Array.isArray(this.permissions)) return false

  const permission = this.permissions.find((p) => p.resource === resource)
  return permission && permission.actions.includes(action)
}

// Instance method to check IP restrictions
apiTokenSchema.methods.isIPAllowed = function (ip) {
  if (!this.restrictions.allowedIPs || this.restrictions.allowedIPs.length === 0) {
    return true // No restrictions
  }
  return this.restrictions.allowedIPs.includes(ip)
}

// Instance method to check domain restrictions
apiTokenSchema.methods.isDomainAllowed = function (domain) {
  if (!this.restrictions.allowedDomains || this.restrictions.allowedDomains.length === 0) {
    return true // No restrictions
  }
  return this.restrictions.allowedDomains.includes(domain)
}

// Instance method to get token summary for logging
apiTokenSchema.methods.getSummary = function () {
  return {
    id: this._id,
    name: this.name,
    organization: this.organization.name || this.organization,
    user: this.user.username || this.user,
    scopes: this.scopes,
    isActive: this.isActive,
    isExpired: this.isExpired,
    expiresAt: this.expiresAt,
    totalRequests: this.usage.totalRequests,
    lastUsedAt: this.usage.lastUsedAt,
  }
}

const ApiToken = mongoose.model("ApiToken", apiTokenSchema)

export default ApiToken
