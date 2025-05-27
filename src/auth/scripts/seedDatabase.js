import dotenv from "dotenv"
import User from "../models/userModel.js"
import Organization from "../models/organizationModel.js"
import OrganizationMember from "../models/organizationMemberModel.js"
import Role from "../models/roleModel.js"
import { connectDB } from "../config/db.js"

dotenv.config()

const seedDatabase = async () => {
  try {
    await connectDB()

    console.log("🌱 Starting database seeding...")

    // Clear existing data
    await Promise.all([
      User.deleteMany({}),
      Organization.deleteMany({}),
      OrganizationMember.deleteMany({}),
      Role.deleteMany({}),
    ])

    console.log("🗑️  Cleared existing data")

    // Create super admin user
    const superAdmin = await User.create({
      username: "superadmin",
      email: "admin@clycites.com",
      password: "SuperAdmin123!",
      firstName: "Super",
      lastName: "Admin",
      globalRole: "super_admin",
      isEmailVerified: true,
    })

    console.log("👤 Created super admin user")

    // Create default ClyCites organization
    const clycitesOrg = await Organization.create({
      name: "ClyCites",
      slug: "clycites",
      description: "The default ClyCites organization for managing the platform",
      industry: "technology",
      size: "enterprise",
      isDefault: true,
      owner: superAdmin._id,
      createdBy: superAdmin._id,
      settings: {
        allowPublicSignup: false,
        requireEmailVerification: true,
        enableSSO: true,
        passwordPolicy: {
          minLength: 8,
          requireUppercase: true,
          requireLowercase: true,
          requireNumbers: true,
          requireSpecialChars: true,
          maxAge: 90,
          preventReuse: 5,
        },
        sessionSettings: {
          maxConcurrentSessions: 10,
          sessionTimeout: 24,
          requireMFA: false,
        },
      },
      subscription: {
        plan: "enterprise",
        status: "active",
        limits: {
          maxUsers: 10000,
          maxTeams: 1000,
          maxApplications: 100,
          maxAPIRequests: 1000000,
        },
      },
    })

    console.log("🏢 Created ClyCites organization")

    // Create system roles for ClyCites organization
    const systemRoles = [
      {
        name: "Platform Owner",
        description: "Full platform control and ownership",
        level: 100,
        permissions: [{ resource: "*", actions: ["*"] }],
        isSystem: true,
      },
      {
        name: "Platform Admin",
        description: "Platform administration access",
        level: 95,
        permissions: [
          { resource: "organizations", actions: ["create", "read", "update", "delete", "manage"] },
          { resource: "users", actions: ["create", "read", "update", "delete", "manage"] },
          { resource: "applications", actions: ["create", "read", "update", "delete", "manage"] },
          { resource: "system", actions: ["read", "update", "manage"] },
        ],
        isSystem: true,
      },
      {
        name: "Organization Owner",
        description: "Full organization control",
        level: 90,
        permissions: [
          { resource: "organization", actions: ["read", "update", "delete", "manage"] },
          { resource: "users", actions: ["create", "read", "update", "delete", "invite", "manage"] },
          { resource: "teams", actions: ["create", "read", "update", "delete", "manage"] },
          { resource: "roles", actions: ["create", "read", "update", "delete"] },
          { resource: "applications", actions: ["create", "read", "update", "delete"] },
          { resource: "billing", actions: ["read", "update", "manage"] },
        ],
        isSystem: true,
      },
      {
        name: "Organization Admin",
        description: "Organization administrative access",
        level: 85,
        permissions: [
          { resource: "users", actions: ["create", "read", "update", "invite", "manage"] },
          { resource: "teams", actions: ["create", "read", "update", "delete", "manage"] },
          { resource: "roles", actions: ["create", "read", "update"] },
          { resource: "applications", actions: ["create", "read", "update"] },
        ],
        isSystem: true,
      },
      {
        name: "Team Manager",
        description: "Team management access",
        level: 70,
        permissions: [
          { resource: "teams", actions: ["create", "read", "update", "manage"] },
          { resource: "users", actions: ["read", "invite"] },
          { resource: "projects", actions: ["create", "read", "update", "delete", "manage"] },
        ],
        isSystem: true,
      },
      {
        name: "Developer",
        description: "Development access",
        level: 60,
        permissions: [
          { resource: "applications", actions: ["create", "read", "update"] },
          { resource: "api-tokens", actions: ["create", "read", "update", "delete"] },
          { resource: "projects", actions: ["read", "update"] },
        ],
        isSystem: true,
      },
      {
        name: "Member",
        description: "Standard member access",
        level: 50,
        permissions: [
          { resource: "profile", actions: ["read", "update"] },
          { resource: "teams", actions: ["read"] },
          { resource: "projects", actions: ["read"] },
        ],
        isSystem: true,
      },
      {
        name: "Viewer",
        description: "Read-only access",
        level: 10,
        permissions: [
          { resource: "profile", actions: ["read"] },
          { resource: "teams", actions: ["read"] },
        ],
        isSystem: true,
      },
    ]

    const createdRoles = await Role.create(
      systemRoles.map((role) => ({
        ...role,
        organization: clycitesOrg._id,
        createdBy: superAdmin._id,
      })),
    )

    console.log("🔐 Created system roles")

    // Add super admin as platform owner
    const platformOwnerRole = createdRoles.find((role) => role.name === "Platform Owner")
    await OrganizationMember.create({
      user: superAdmin._id,
      organization: clycitesOrg._id,
      role: platformOwnerRole._id,
      status: "active",
      joinedAt: new Date(),
    })

    console.log("👑 Added super admin as platform owner")

    // Create sample users
    const sampleUsers = [
      {
        username: "johndoe",
        email: "john@example.com",
        password: "Password123!",
        firstName: "John",
        lastName: "Doe",
        isEmailVerified: true,
      },
      {
        username: "janesmith",
        email: "jane@example.com",
        password: "Password123!",
        firstName: "Jane",
        lastName: "Smith",
        isEmailVerified: true,
      },
    ]

    const createdUsers = await User.create(sampleUsers)
    console.log("👥 Created sample users")

    // Add sample users to ClyCites organization
    const memberRole = createdRoles.find((role) => role.name === "Member")
    for (const user of createdUsers) {
      await OrganizationMember.create({
        user: user._id,
        organization: clycitesOrg._id,
        role: memberRole._id,
        status: "active",
        joinedAt: new Date(),
      })
    }

    console.log("✅ Database seeding completed successfully!")
    console.log("\n📋 Seeded data summary:")
    console.log(`   • 1 Super Admin: admin@clycites.com (password: SuperAdmin123!)`)
    console.log(`   • 1 Default Organization: ClyCites`)
    console.log(`   • ${systemRoles.length} System Roles`)
    console.log(`   • ${sampleUsers.length} Sample Users`)
    console.log("\n🚀 You can now start the server and begin using the authentication system!")

    process.exit(0)
  } catch (error) {
    console.error("❌ Error seeding database:", error)
    process.exit(1)
  }
}

seedDatabase()
