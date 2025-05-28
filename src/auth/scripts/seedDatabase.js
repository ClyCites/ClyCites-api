import dotenv from "dotenv"
import User from "../models/userModel.js"
import Organization from "../models/organizationModel.js"
import OrganizationMember from "../models/organizationMemberModel.js"
import Role from "../models/roleModel.js"
import { connectDB } from "../config/db.js"

dotenv.config()

const seedDatabase = async () => {
  try {
    console.log("🌱 Starting database seeding...")
    console.log(`📍 Environment: ${process.env.NODE_ENV || "development"}`)
    console.log(`🔗 Database: ${process.env.MONGODB_URI ? "MongoDB Atlas" : "Local MongoDB"}`)

    await connectDB()

    // Check if data already exists
    const existingUsers = await User.countDocuments()
    const existingOrgs = await Organization.countDocuments()

    if (existingUsers > 0 || existingOrgs > 0) {
      console.log("⚠️  Database already contains data!")
      console.log(`   Users: ${existingUsers}, Organizations: ${existingOrgs}`)

      const readline = await import("readline")
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      })

      const answer = await new Promise((resolve) => {
        rl.question("Do you want to clear existing data and reseed? (yes/no): ", resolve)
      })
      rl.close()

      if (answer.toLowerCase() !== "yes" && answer.toLowerCase() !== "y") {
        console.log("❌ Seeding cancelled by user")
        process.exit(0)
      }
    }

    // Clear existing data
    console.log("🗑️  Clearing existing data...")
    await Promise.all([
      User.deleteMany({}),
      Organization.deleteMany({}),
      OrganizationMember.deleteMany({}),
      Role.deleteMany({}),
    ])

    console.log("✅ Cleared existing data")

    // Create super admin user
    console.log("👤 Creating super admin user...")
    const superAdmin = await User.create({
      username: "superadmin",
      email: "admin@clycites.com",
      password: "SuperAdmin123!",
      firstName: "Super",
      lastName: "Admin",
      globalRole: "super_admin",
      isEmailVerified: true,
    })

    console.log("✅ Created super admin user")

    // Create default ClyCites organization
    console.log("🏢 Creating ClyCites organization...")
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

    console.log("✅ Created ClyCites organization")

    // Define all available actions based on the Role model enum
    const allActions = ["create", "read", "update", "delete", "manage", "invite", "approve", "export", "import"]

    // Create system roles for ClyCites organization
    console.log("🔐 Creating system roles...")
    const systemRoles = [
      {
        name: "Platform Owner",
        slug: "platform-owner",
        description: "Full platform control and ownership",
        level: 100,
        permissions: [
          { resource: "organizations", actions: allActions },
          { resource: "users", actions: allActions },
          { resource: "teams", actions: allActions },
          { resource: "roles", actions: allActions },
          { resource: "applications", actions: allActions },
          { resource: "system", actions: allActions },
          { resource: "billing", actions: allActions },
          { resource: "analytics", actions: allActions },
        ],
        isSystem: true,
      },
      {
        name: "Platform Admin",
        slug: "platform-admin",
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
        slug: "organization-owner",
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
        slug: "organization-admin",
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
        slug: "team-manager",
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
        slug: "developer",
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
        slug: "member",
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
        slug: "viewer",
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

    console.log(`✅ Created ${createdRoles.length} system roles`)

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

    // Drop existing indexes to avoid conflicts
    console.log("🔧 Cleaning up database indexes...")
    try {
      await User.collection.dropIndexes()
      console.log("✅ Dropped existing User indexes")
    } catch (error) {
      console.log("ℹ️  No existing indexes to drop")
    }

    // Create sample users
    console.log("👥 Creating sample users...")
    const sampleUsers = [
      {
        username: "johndoe",
        email: "john@example.com",
        password: "Password123!",
        firstName: "John",
        lastName: "Doe",
        phone: "+1234567890",
        isEmailVerified: true,
      },
      {
        username: "janesmith",
        email: "jane@example.com",
        password: "Password123!",
        firstName: "Jane",
        lastName: "Smith",
        phone: "+1987654321",
        isEmailVerified: true,
      },
    ]

    const createdUsers = await User.create(sampleUsers)
    console.log(`✅ Created ${createdUsers.length} sample users`)

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

    console.log("✅ Added sample users to ClyCites organization")

    console.log("\n🎉 Database seeding completed successfully!")
    console.log("\n📋 Seeded data summary:")
    console.log(`   • 1 Super Admin: admin@clycites.com (password: SuperAdmin123!)`)
    console.log(`   • 1 Default Organization: ClyCites`)
    console.log(`   • ${systemRoles.length} System Roles`)
    console.log(`   • ${sampleUsers.length} Sample Users`)
    console.log("\n🔐 Login credentials:")
    console.log("   Super Admin: admin@clycites.com / SuperAdmin123!")
    console.log("   Sample User 1: john@example.com / Password123!")
    console.log("   Sample User 2: jane@example.com / Password123!")
    console.log("\n🚀 You can now start the server and begin using the authentication system!")
    const PORT = process.env.PORT || 5000
    console.log(`📍 Server will run on: http://localhost:${PORT}`)

    process.exit(0)
  } catch (error) {
    console.error("❌ Error seeding database:", error)

    // Provide helpful error messages
    if (error.name === "MongoServerSelectionError") {
      console.error("💡 MongoDB connection failed. Please check:")
      console.error("   - Your MongoDB Atlas connection string")
      console.error("   - Network access settings in MongoDB Atlas")
      console.error("   - Database user permissions")
    }

    if (error.name === "ValidationError") {
      console.error("💡 Database validation failed. This might be due to:")
      console.error("   - Schema changes that require model updates")
      console.error("   - Invalid enum values in the data")
      console.error("   - Missing required fields")
    }

    process.exit(1)
  }
}

// Handle process termination
process.on("SIGINT", () => {
  console.log("\n⚠️  Seeding interrupted by user")
  process.exit(0)
})

seedDatabase()
