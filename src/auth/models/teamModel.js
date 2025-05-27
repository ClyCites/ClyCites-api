import mongoose from "mongoose"

const teamSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Team name is required"],
      trim: true,
      maxlength: [100, "Team name cannot exceed 100 characters"],
    },
    slug: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
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
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team",
      default: null,
    },
    type: {
      type: String,
      enum: ["department", "project", "functional", "cross-functional"],
      default: "functional",
    },
    visibility: {
      type: String,
      enum: ["public", "private", "secret"],
      default: "private",
    },
    settings: {
      allowMemberInvite: { type: Boolean, default: false },
      requireApproval: { type: Boolean, default: true },
      autoAssignRole: {
        type: String,
        enum: ["member", "contributor", "viewer"],
        default: "member",
      },
    },
    lead: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
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

// Compound index for organization and slug uniqueness
teamSchema.index({ organization: 1, slug: 1 }, { unique: true })
teamSchema.index({ organization: 1, parent: 1 })
teamSchema.index({ lead: 1 })

// Virtual for member count
teamSchema.virtual("memberCount", {
  ref: "TeamMember",
  localField: "_id",
  foreignField: "team",
  count: true,
})

// Virtual for subteam count
teamSchema.virtual("subteamCount", {
  ref: "Team",
  localField: "_id",
  foreignField: "parent",
  count: true,
})

// Pre-save middleware to generate slug
teamSchema.pre("save", function (next) {
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

const Team = mongoose.model("Team", teamSchema)

export default Team
