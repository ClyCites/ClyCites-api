import mongoose from "mongoose"

const roleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Role name is required"],
      trim: true,
      maxlength: [50, "Role name cannot exceed 50 characters"],
    },
    slug: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    description: {
      type: String,
      maxlength: [200, "Description cannot exceed 200 characters"],
    },
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    type: {
      type: String,
      enum: ["system", "organization", "team", "application"],
      default: "organization",
    },
    level: {
      type: Number,
      min: 0,
      max: 100,
      default: 10,
    },
    permissions: [
      {
        resource: {
          type: String,
          required: true,
        },
        actions: [
          {
            type: String,
            enum: ["create", "read", "update", "delete", "manage", "invite", "approve", "export", "import"],
          },
        ],
        conditions: {
          type: mongoose.Schema.Types.Mixed,
          default: {},
        },
      },
    ],
    inheritsFrom: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Role",
      },
    ],
    isSystem: {
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
  },
)

// Compound index for organization and slug uniqueness
roleSchema.index({ organization: 1, slug: 1 }, { unique: true })
roleSchema.index({ type: 1, level: 1 })
roleSchema.index({ isSystem: 1 })

// Pre-save middleware to generate slug
roleSchema.pre("save", function (next) {
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

// Method to check if role has permission
roleSchema.methods.hasPermission = function (resource, action, context = {}) {
  // Check direct permissions
  const permission = this.permissions.find((p) => p.resource === resource)
  if (permission && permission.actions.includes(action)) {
    // Check conditions if any
    if (permission.conditions && Object.keys(permission.conditions).length > 0) {
      return this.evaluateConditions(permission.conditions, context)
    }
    return true
  }

  // Check inherited permissions
  // This would need to be populated and checked recursively
  return false
}

// Method to evaluate permission conditions
roleSchema.methods.evaluateConditions = (conditions, context) => {
  // Simple condition evaluation - can be extended
  for (const [key, value] of Object.entries(conditions)) {
    if (context[key] !== value) {
      return false
    }
  }
  return true
}

const Role = mongoose.model("Role", roleSchema)

export default Role
