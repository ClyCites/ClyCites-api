import mongoose from "mongoose"

const organizationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Organization name is required"],
      trim: true,
      maxlength: [100, "Organization name cannot exceed 100 characters"],
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers, and hyphens"],
    },
    description: {
      type: String,
      maxlength: [500, "Description cannot exceed 500 characters"],
    },
    logo: {
      type: String,
      default: null,
    },
    website: {
      type: String,
      match: [/^https?:\/\/.+/, "Please provide a valid website URL"],
    },
    industry: {
      type: String,
      enum: [
        "technology",
        "healthcare",
        "finance",
        "education",
        "retail",
        "manufacturing",
        "consulting",
        "media",
        "nonprofit",
        "government",
        "other",
      ],
    },
    size: {
      type: String,
      enum: ["startup", "small", "medium", "large", "enterprise"],
      default: "small",
    },
    settings: {
      allowPublicSignup: {
        type: Boolean,
        default: false,
      },
      requireEmailVerification: {
        type: Boolean,
        default: true,
      },
      enableSSO: {
        type: Boolean,
        default: false,
      },
      ssoProvider: {
        type: String,
        enum: ["google", "microsoft", "okta", "auth0", "saml", "ldap"],
      },
      ssoConfig: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
      },
      passwordPolicy: {
        minLength: { type: Number, default: 8 },
        requireUppercase: { type: Boolean, default: true },
        requireLowercase: { type: Boolean, default: true },
        requireNumbers: { type: Boolean, default: true },
        requireSpecialChars: { type: Boolean, default: true },
        maxAge: { type: Number, default: 90 }, // days
        preventReuse: { type: Number, default: 5 }, // last N passwords
      },
      sessionSettings: {
        maxConcurrentSessions: { type: Number, default: 5 },
        sessionTimeout: { type: Number, default: 24 }, // hours
        requireMFA: { type: Boolean, default: false },
      },
    },
    subscription: {
      plan: {
        type: String,
        enum: ["free", "starter", "professional", "enterprise"],
        default: "free",
      },
      status: {
        type: String,
        enum: ["active", "suspended", "cancelled", "trial"],
        default: "trial",
      },
      limits: {
        maxUsers: { type: Number, default: 10 },
        maxTeams: { type: Number, default: 3 },
        maxApplications: { type: Number, default: 5 },
        maxAPIRequests: { type: Number, default: 10000 }, // per month
      },
      billingEmail: String,
      trialEndsAt: Date,
      nextBillingDate: Date,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    isDefault: {
      type: Boolean,
      default: false,
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
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
)

// Indexes
organizationSchema.index({ slug: 1 })
organizationSchema.index({ owner: 1 })
organizationSchema.index({ isDefault: 1 })
organizationSchema.index({ "subscription.status": 1 })

// Virtual for member count
organizationSchema.virtual("memberCount", {
  ref: "OrganizationMember",
  localField: "_id",
  foreignField: "organization",
  count: true,
})

// Virtual for team count
organizationSchema.virtual("teamCount", {
  ref: "Team",
  localField: "_id",
  foreignField: "organization",
  count: true,
})

// Pre-save middleware to generate slug
organizationSchema.pre("save", function (next) {
  if (this.isModified("name") && !this.slug) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .trim("-")
  }
  next()
})

// Ensure only one default organization
organizationSchema.pre("save", async function (next) {
  if (this.isDefault && this.isModified("isDefault")) {
    await this.constructor.updateMany({ _id: { $ne: this._id }, isDefault: true }, { isDefault: false })
  }
  next()
})

const Organization = mongoose.model("Organization", organizationSchema)

export default Organization
