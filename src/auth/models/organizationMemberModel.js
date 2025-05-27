import mongoose from "mongoose"

const organizationMemberSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    role: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Role",
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "inactive", "pending", "suspended"],
      default: "pending",
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    invitedAt: {
      type: Date,
      default: Date.now,
    },
    lastActivity: {
      type: Date,
      default: Date.now,
    },
    permissions: [
      {
        resource: String,
        actions: [String],
        granted: { type: Boolean, default: true },
        grantedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        grantedAt: { type: Date, default: Date.now },
      },
    ],
  },
  {
    timestamps: true,
  },
)

// Compound index to ensure unique user-organization combination
organizationMemberSchema.index({ user: 1, organization: 1 }, { unique: true })
organizationMemberSchema.index({ organization: 1, status: 1 })
organizationMemberSchema.index({ role: 1 })

const OrganizationMember = mongoose.model("OrganizationMember", organizationMemberSchema)

export default OrganizationMember
