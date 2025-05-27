import mongoose from "mongoose"
import bcrypt from "bcryptjs"
import crypto from "crypto"

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, "Username is required"],
      unique: true,
      trim: true,
      minlength: [3, "Username must be at least 3 characters long"],
      maxlength: [30, "Username cannot exceed 30 characters"],
      match: [/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, "Please provide a valid email address"],
    },
    password: {
      type: String,
      required: function () {
        return !this.ssoProviders || this.ssoProviders.length === 0
      },
      minlength: [8, "Password must be at least 8 characters long"],
      select: false,
    },
    firstName: {
      type: String,
      required: [true, "First name is required"],
      trim: true,
      maxlength: [50, "First name cannot exceed 50 characters"],
    },
    lastName: {
      type: String,
      required: [true, "Last name is required"],
      trim: true,
      maxlength: [50, "First name cannot exceed 50 characters"],
    },
    profilePicture: {
      type: String,
      default: null,
    },
    phone: {
      type: String,
      match: [/^\+?[\d\s-()]+$/, "Please provide a valid phone number"],
    },
    timezone: {
      type: String,
      default: "UTC",
    },
    locale: {
      type: String,
      default: "en",
    },

    // Authentication & Security
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerificationToken: String,
    emailVerificationExpires: Date,
    passwordResetToken: String,
    passwordResetExpires: Date,
    passwordHistory: [
      {
        hash: String,
        createdAt: { type: Date, default: Date.now },
      },
    ],

    // Multi-factor Authentication
    mfa: {
      isEnabled: { type: Boolean, default: false },
      secret: String,
      backupCodes: [String],
      lastUsedAt: Date,
    },

    // SSO Providers
    ssoProviders: [
      {
        provider: {
          type: String,
          enum: ["google", "microsoft", "github", "linkedin", "okta", "auth0"],
        },
        providerId: String,
        email: String,
        isVerified: { type: Boolean, default: false },
        connectedAt: { type: Date, default: Date.now },
      },
    ],

    // Session Management
    refreshTokens: [
      {
        token: String,
        device: String,
        userAgent: String,
        ipAddress: String,
        createdAt: {
          type: Date,
          default: Date.now,
          expires: 604800, // 7 days
        },
      },
    ],
    activeSessions: [
      {
        sessionId: String,
        device: String,
        userAgent: String,
        ipAddress: String,
        lastActivity: { type: Date, default: Date.now },
        expiresAt: Date,
      },
    ],

    // Account Security
    lastLogin: {
      type: Date,
      default: Date.now,
    },
    lastPasswordChange: {
      type: Date,
      default: Date.now,
    },
    loginAttempts: {
      type: Number,
      default: 0,
    },
    lockUntil: Date,
    isActive: {
      type: Boolean,
      default: true,
    },

    // Global System Role (for system-wide permissions)
    globalRole: {
      type: String,
      enum: ["super_admin", "system_admin", "support", "user"],
      default: "user",
    },

    // User Preferences
    preferences: {
      theme: { type: String, enum: ["light", "dark", "auto"], default: "auto" },
      notifications: {
        email: { type: Boolean, default: true },
        push: { type: Boolean, default: true },
        sms: { type: Boolean, default: false },
      },
      privacy: {
        profileVisibility: { type: String, enum: ["public", "organization", "private"], default: "organization" },
        showEmail: { type: Boolean, default: false },
        showPhone: { type: Boolean, default: false },
      },
    },

    // Metadata
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    // Audit
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    lastModifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
)

// Virtual for full name
userSchema.virtual("fullName").get(function () {
  return `${this.firstName} ${this.lastName}`
})

// Virtual for account lock status
userSchema.virtual("isLocked").get(function () {
  return !!(this.lockUntil && this.lockUntil > Date.now())
})

// Indexes for performance
userSchema.index({ email: 1 })
userSchema.index({ username: 1 })
userSchema.index({ "ssoProviders.provider": 1, "ssoProviders.providerId": 1 })
userSchema.index({ emailVerificationToken: 1 })
userSchema.index({ passwordResetToken: 1 })
userSchema.index({ globalRole: 1 })
userSchema.index({ isActive: 1 })

// Pre-save middleware to hash password
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next()

  try {
    const salt = await bcrypt.genSalt(12)
    this.password = await bcrypt.hash(this.password, salt)
    this.lastPasswordChange = new Date()

    // Add to password history
    if (this.password) {
      this.passwordHistory.push({
        hash: this.password,
        createdAt: new Date(),
      })

      // Keep only last 5 passwords
      if (this.passwordHistory.length > 5) {
        this.passwordHistory = this.passwordHistory.slice(-5)
      }
    }

    next()
  } catch (error) {
    next(error)
  }
})

// Instance method to check password
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password)
}

// Instance method to check if password was used before
userSchema.methods.wasPasswordUsedBefore = async function (password) {
  for (const oldPassword of this.passwordHistory) {
    if (await bcrypt.compare(password, oldPassword.hash)) {
      return true
    }
  }
  return false
}

// Instance method to generate email verification token
userSchema.methods.generateEmailVerificationToken = function () {
  const verificationToken = crypto.randomBytes(32).toString("hex")

  this.emailVerificationToken = crypto.createHash("sha256").update(verificationToken).digest("hex")

  this.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000 // 24 hours

  return verificationToken
}

// Instance method to generate password reset token
userSchema.methods.generatePasswordResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString("hex")

  this.passwordResetToken = crypto.createHash("sha256").update(resetToken).digest("hex")

  this.passwordResetExpires = Date.now() + 10 * 60 * 1000 // 10 minutes

  return resetToken
}

// Instance method to handle failed login attempts
userSchema.methods.incLoginAttempts = function () {
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $unset: { lockUntil: 1 },
      $set: { loginAttempts: 1 },
    })
  }

  const updates = { $inc: { loginAttempts: 1 } }

  if (this.loginAttempts + 1 >= 5 && !this.isLocked) {
    updates.$set = { lockUntil: Date.now() + 2 * 60 * 60 * 1000 } // 2 hours
  }

  return this.updateOne(updates)
}

// Instance method to reset login attempts
userSchema.methods.resetLoginAttempts = function () {
  return this.updateOne({
    $unset: { loginAttempts: 1, lockUntil: 1 },
  })
}

// Static method to find user by credentials
userSchema.statics.findByCredentials = async function (identifier, password) {
  const user = await this.findOne({
    $or: [{ email: identifier.toLowerCase() }, { username: identifier }],
    isActive: true,
  }).select("+password")

  if (!user) {
    throw new Error("Invalid credentials")
  }

  if (user.isLocked) {
    throw new Error("Account temporarily locked due to too many failed login attempts")
  }

  const isMatch = await user.matchPassword(password)
  if (!isMatch) {
    await user.incLoginAttempts()
    throw new Error("Invalid credentials")
  }

  if (user.loginAttempts > 0) {
    await user.resetLoginAttempts()
  }

  user.lastLogin = new Date()
  await user.save()

  return user
}

const User = mongoose.model("User", userSchema)

export default User
