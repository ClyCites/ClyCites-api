import dotenv from "dotenv"
import User from "../models/userModel.js"
import Organization from "../models/organizationModel.js"
import OrganizationMember from "../models/organizationMemberModel.js"
import Role from "../models/roleModel.js"
import { connectDB } from "../config/db.js"
import Application from "../models/applicationModel.js"

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
      Application.deleteMany({}),
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
      {
        username: "mikejohnson",
        email: "mike@example.com",
        password: "Password123!",
        firstName: "Mike",
        lastName: "Johnson",
        phone: "+1122334455",
        isEmailVerified: true,
      },
      {
        username: "sarahwilson",
        email: "sarah@example.com",
        password: "Password123!",
        firstName: "Sarah",
        lastName: "Wilson",
        phone: "+1555666777",
        isEmailVerified: true,
      },
    ]

    const createdUsers = await User.create(sampleUsers)
    console.log(`✅ Created ${createdUsers.length} sample users`)

    // Add sample users to ClyCites organization with different roles
    const memberRole = createdRoles.find((role) => role.name === "Member")
    const developerRole = createdRoles.find((role) => role.name === "Developer")
    const teamManagerRole = createdRoles.find((role) => role.name === "Team Manager")
    const orgAdminRole = createdRoles.find((role) => role.name === "Organization Admin")

    const userRoleAssignments = [
      { user: createdUsers[0], role: orgAdminRole }, // John as Org Admin
      { user: createdUsers[1], role: teamManagerRole }, // Jane as Team Manager
      { user: createdUsers[2], role: developerRole }, // Mike as Developer
      { user: createdUsers[3], role: memberRole }, // Sarah as Member
    ]

    for (const assignment of userRoleAssignments) {
      await OrganizationMember.create({
        user: assignment.user._id,
        organization: clycitesOrg._id,
        role: assignment.role._id,
        status: "active",
        joinedAt: new Date(),
      })
    }

    console.log("✅ Added sample users to ClyCites organization with roles")

    // Create additional sample organizations
    console.log("🏢 Creating additional sample organizations...")
    const sampleOrganizations = [
      {
        name: "TechCorp Solutions",
        slug: "techcorp-solutions",
        description: "A technology consulting company",
        industry: "technology",
        size: "medium",
        owner: createdUsers[0]._id, // John
        createdBy: createdUsers[0]._id,
        settings: {
          allowPublicSignup: true,
          requireEmailVerification: true,
          enableSSO: false,
          passwordPolicy: {
            minLength: 8,
            requireUppercase: true,
            requireLowercase: true,
            requireNumbers: true,
            requireSpecialChars: false,
            maxAge: 180,
            preventReuse: 3,
          },
          sessionSettings: {
            maxConcurrentSessions: 5,
            sessionTimeout: 8,
            requireMFA: false,
          },
        },
        subscription: {
          plan: "professional",
          status: "active",
          limits: {
            maxUsers: 100,
            maxTeams: 20,
            maxApplications: 10,
            maxAPIRequests: 50000,
          },
        },
      },
      {
        name: "StartupHub",
        slug: "startuphub",
        description: "An innovative startup accelerator",
        industry: "technology", // Changed from "business_services" to "technology"
        size: "small",
        owner: createdUsers[1]._id, // Jane
        createdBy: createdUsers[1]._id,
        settings: {
          allowPublicSignup: false,
          requireEmailVerification: true,
          enableSSO: false,
          passwordPolicy: {
            minLength: 6,
            requireUppercase: false,
            requireLowercase: true,
            requireNumbers: true,
            requireSpecialChars: false,
            maxAge: 365,
            preventReuse: 2,
          },
          sessionSettings: {
            maxConcurrentSessions: 3,
            sessionTimeout: 12,
            requireMFA: false,
          },
        },
        subscription: {
          plan: "starter", // Changed from "basic" to "starter"
          status: "active",
          limits: {
            maxUsers: 25,
            maxTeams: 5,
            maxApplications: 3,
            maxAPIRequests: 10000,
          },
        },
      },
    ]

    const additionalOrgs = await Organization.create(sampleOrganizations)
    console.log(`✅ Created ${additionalOrgs.length} additional organizations`)

    // Create roles for additional organizations and add members
    for (let i = 0; i < additionalOrgs.length; i++) {
      const org = additionalOrgs[i]
      const owner = createdUsers[i]

      // Create basic roles for each organization
      const orgRoles = [
        {
          name: "Owner",
          slug: "owner",
          description: "Organization owner with full control",
          level: 90,
          permissions: [
            { resource: "organization", actions: ["read", "update", "delete", "manage"] },
            { resource: "users", actions: ["create", "read", "update", "delete", "invite", "manage"] },
            { resource: "teams", actions: ["create", "read", "update", "delete", "manage"] },
            { resource: "roles", actions: ["create", "read", "update", "delete"] },
          ],
          organization: org._id,
          createdBy: owner._id,
          isSystem: false,
        },
        {
          name: "Admin",
          slug: "admin",
          description: "Administrative access",
          level: 80,
          permissions: [
            { resource: "users", actions: ["create", "read", "update", "invite"] },
            { resource: "teams", actions: ["create", "read", "update", "delete"] },
          ],
          organization: org._id,
          createdBy: owner._id,
          isSystem: false,
        },
        {
          name: "Member",
          slug: "member",
          description: "Standard member access",
          level: 50,
          permissions: [
            { resource: "profile", actions: ["read", "update"] },
            { resource: "teams", actions: ["read"] },
          ],
          organization: org._id,
          createdBy: owner._id,
          isSystem: false,
        },
      ]

      const createdOrgRoles = await Role.create(orgRoles)

      // Add owner to their organization
      const ownerRole = createdOrgRoles.find((role) => role.name === "Owner")
      await OrganizationMember.create({
        user: owner._id,
        organization: org._id,
        role: ownerRole._id,
        status: "active",
        joinedAt: new Date(),
      })

      // Add some other users as members
      const memberRole = createdOrgRoles.find((role) => role.name === "Member")
      const otherUsers = createdUsers.filter((user) => user._id.toString() !== owner._id.toString()).slice(0, 2)

      for (const user of otherUsers) {
        await OrganizationMember.create({
          user: user._id,
          organization: org._id,
          role: memberRole._id,
          status: "active",
          joinedAt: new Date(),
        })
      }

      console.log(`✅ Created roles and members for ${org.name}`)
    }

    // Create sample applications
    console.log("📱 Creating sample applications...")

    const sampleApplications = [
      // ClyCites Platform Applications
      {
        name: "ClyCites Admin Dashboard",
        description: "Main administrative dashboard for platform management",
        organization: clycitesOrg._id,
        type: "web",
        platform: "web",
        redirectUris: [
          "http://localhost:3000/auth/callback",
          "https://admin.clycites.com/auth/callback",
          "https://dashboard.clycites.com/auth/callback",
        ],
        allowedOrigins: ["http://localhost:3000", "https://admin.clycites.com", "https://dashboard.clycites.com"],
        scopes: [
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
        grantTypes: ["authorization_code", "refresh_token"],
        tokenSettings: {
          accessTokenTTL: 3600, // 1 hour
          refreshTokenTTL: 2592000, // 30 days
          allowRefreshToken: true,
          reuseRefreshToken: false,
        },
        rateLimits: {
          requestsPerMinute: 1000,
          requestsPerHour: 10000,
          requestsPerDay: 100000,
        },
        webhooks: [
          {
            url: "https://admin.clycites.com/webhooks/auth",
            events: ["user.created", "user.updated", "user.deleted"],
            secret: "webhook_secret_admin_dashboard",
            isActive: true,
          },
        ],
        metadata: {
          version: "1.0.0",
          environment: "production",
          maintainer: "ClyCites Platform Team",
        },
        createdBy: superAdmin._id,
      },
      {
        name: "ClyCites Mobile App",
        description: "Official ClyCites mobile application for iOS and Android",
        organization: clycitesOrg._id,
        type: "mobile",
        platform: "cross-platform",
        redirectUris: ["https://mobile.clycites.com/auth/callback", "https://app.clycites.com/auth/callback"],
        allowedOrigins: ["https://mobile.clycites.com", "https://app.clycites.com"],
        scopes: ["profile", "email", "teams", "read", "write"],
        grantTypes: ["authorization_code", "refresh_token"],
        tokenSettings: {
          accessTokenTTL: 7200, // 2 hours
          refreshTokenTTL: 7776000, // 90 days
          allowRefreshToken: true,
          reuseRefreshToken: false,
        },
        rateLimits: {
          requestsPerMinute: 200,
          requestsPerHour: 2000,
          requestsPerDay: 20000,
        },
        metadata: {
          version: "2.1.0",
          platforms: ["iOS", "Android"],
          minVersion: "2.0.0",
          customSchemes: ["clycites://", "com.clycites.app://"], // Store custom schemes in metadata
        },
        createdBy: superAdmin._id,
      },
      {
        name: "ClyCites API Gateway",
        description: "Internal API gateway for microservices communication",
        organization: clycitesOrg._id,
        type: "service",
        platform: "web",
        redirectUris: [], // No redirect URIs for service-to-service
        allowedOrigins: ["https://api.clycites.com", "https://gateway.clycites.com"],
        scopes: ["read", "write", "admin"],
        grantTypes: ["client_credentials"],
        tokenSettings: {
          accessTokenTTL: 1800, // 30 minutes
          refreshTokenTTL: 0, // No refresh for service-to-service
          allowRefreshToken: false,
          reuseRefreshToken: false,
        },
        rateLimits: {
          requestsPerMinute: 5000,
          requestsPerHour: 50000,
          requestsPerDay: 500000,
        },
        metadata: {
          serviceType: "gateway",
          internal: true,
          criticality: "high",
        },
        createdBy: superAdmin._id,
      },

      // TechCorp Solutions Applications
      {
        name: "TechCorp Client Portal",
        description: "Customer-facing portal for TechCorp clients",
        organization: additionalOrgs[0]._id, // TechCorp Solutions
        type: "web",
        platform: "web",
        redirectUris: ["https://portal.techcorp.com/auth/callback", "http://localhost:3001/auth/callback"],
        allowedOrigins: ["https://portal.techcorp.com", "http://localhost:3001"],
        scopes: ["profile", "email", "read", "write"],
        grantTypes: ["authorization_code", "refresh_token"],
        tokenSettings: {
          accessTokenTTL: 3600,
          refreshTokenTTL: 1209600, // 14 days
          allowRefreshToken: true,
          reuseRefreshToken: true,
        },
        rateLimits: {
          requestsPerMinute: 100,
          requestsPerHour: 1000,
          requestsPerDay: 10000,
        },
        webhooks: [
          {
            url: "https://portal.techcorp.com/webhooks/user-events",
            events: ["user.login", "user.logout"],
            secret: "techcorp_webhook_secret",
            isActive: true,
          },
        ],
        metadata: {
          clientType: "external",
          industry: "consulting",
        },
        createdBy: createdUsers[0]._id, // John
      },
      {
        name: "TechCorp Analytics Dashboard",
        description: "Internal analytics and reporting dashboard",
        organization: additionalOrgs[0]._id,
        type: "web",
        platform: "web",
        redirectUris: ["https://analytics.techcorp.internal/auth/callback"],
        allowedOrigins: ["https://analytics.techcorp.internal"],
        scopes: ["profile", "analytics", "read"],
        grantTypes: ["authorization_code"],
        tokenSettings: {
          accessTokenTTL: 28800, // 8 hours
          refreshTokenTTL: 604800, // 7 days
          allowRefreshToken: true,
          reuseRefreshToken: false,
        },
        rateLimits: {
          requestsPerMinute: 50,
          requestsPerHour: 500,
          requestsPerDay: 5000,
        },
        metadata: {
          internal: true,
          department: "analytics",
        },
        createdBy: createdUsers[0]._id, // John
      },
      {
        name: "TechCorp Mobile Workforce",
        description: "Mobile app for field technicians and remote workers",
        organization: additionalOrgs[0]._id,
        type: "mobile",
        platform: "cross-platform",
        redirectUris: ["https://mobile.techcorp.com/auth/callback"],
        allowedOrigins: ["https://mobile.techcorp.com"],
        scopes: ["profile", "email", "teams", "read", "write"],
        grantTypes: ["authorization_code", "refresh_token"],
        tokenSettings: {
          accessTokenTTL: 14400, // 4 hours
          refreshTokenTTL: 2592000, // 30 days
          allowRefreshToken: true,
          reuseRefreshToken: false,
        },
        rateLimits: {
          requestsPerMinute: 60,
          requestsPerHour: 600,
          requestsPerDay: 6000,
        },
        metadata: {
          targetUsers: "field_workers",
          offlineCapable: true,
          customSchemes: ["techcorp://"], // Store custom schemes in metadata
        },
        createdBy: createdUsers[0]._id, // John
      },

      // StartupHub Applications
      {
        name: "StartupHub Accelerator Platform",
        description: "Main platform for startup accelerator program management",
        organization: additionalOrgs[1]._id, // StartupHub
        type: "web",
        platform: "web",
        redirectUris: ["https://platform.startuphub.com/auth/callback", "http://localhost:3002/auth/callback"],
        allowedOrigins: ["https://platform.startuphub.com", "http://localhost:3002"],
        scopes: ["profile", "email", "organizations", "teams", "read", "write"],
        grantTypes: ["authorization_code", "refresh_token"],
        tokenSettings: {
          accessTokenTTL: 7200, // 2 hours
          refreshTokenTTL: 1209600, // 14 days
          allowRefreshToken: true,
          reuseRefreshToken: false,
        },
        rateLimits: {
          requestsPerMinute: 80,
          requestsPerHour: 800,
          requestsPerDay: 8000,
        },
        webhooks: [
          {
            url: "https://platform.startuphub.com/webhooks/program-events",
            events: ["user.enrolled", "program.completed"],
            secret: "startuphub_webhook_secret",
            isActive: true,
          },
        ],
        metadata: {
          programType: "accelerator",
          cohortBased: true,
        },
        createdBy: createdUsers[1]._id, // Jane
      },
      {
        name: "StartupHub Mentor Connect",
        description: "Mobile app connecting startups with mentors",
        organization: additionalOrgs[1]._id,
        type: "mobile",
        platform: "cross-platform",
        redirectUris: ["https://mentor.startuphub.com/auth/callback"],
        allowedOrigins: ["https://mentor.startuphub.com"],
        scopes: ["profile", "email", "read"],
        grantTypes: ["authorization_code", "refresh_token"],
        tokenSettings: {
          accessTokenTTL: 10800, // 3 hours
          refreshTokenTTL: 2592000, // 30 days
          allowRefreshToken: true,
          reuseRefreshToken: false,
        },
        rateLimits: {
          requestsPerMinute: 40,
          requestsPerHour: 400,
          requestsPerDay: 4000,
        },
        metadata: {
          userTypes: ["startups", "mentors"],
          matchingAlgorithm: "v2.0",
          customSchemes: ["startuphub://"], // Store custom schemes in metadata
        },
        createdBy: createdUsers[1]._id, // Jane
      },
      {
        name: "StartupHub API Integration",
        description: "API service for third-party integrations and data sync",
        organization: additionalOrgs[1]._id,
        type: "api",
        platform: "web",
        redirectUris: [], // No redirect URIs for API service
        allowedOrigins: ["https://api.startuphub.com"],
        scopes: ["read", "write"],
        grantTypes: ["client_credentials", "authorization_code"],
        tokenSettings: {
          accessTokenTTL: 3600, // 1 hour
          refreshTokenTTL: 86400, // 1 day
          allowRefreshToken: true,
          reuseRefreshToken: false,
        },
        rateLimits: {
          requestsPerMinute: 200,
          requestsPerHour: 2000,
          requestsPerDay: 20000,
        },
        metadata: {
          apiVersion: "v1",
          integrationPartners: ["Slack", "Notion", "Airtable"],
        },
        createdBy: createdUsers[1]._id, // Jane
      },
    ]

    // Create applications one by one to ensure pre-save middleware runs
    const createdApplications = []
    for (const appData of sampleApplications) {
      try {
        const app = new Application(appData)
        const savedApp = await app.save()
        createdApplications.push(savedApp)
        console.log(`✅ Created application: ${app.name}`)
      } catch (error) {
        console.error(`❌ Failed to create application ${appData.name}:`, error.message)
      }
    }

    console.log(`✅ Created ${createdApplications.length} sample applications`)

    // Display application information
    console.log("\n📱 Sample Applications Created:")
    for (const app of createdApplications) {
      const org =
        app.organization.toString() === clycitesOrg._id.toString()
          ? "ClyCites"
          : app.organization.toString() === additionalOrgs[0]._id.toString()
            ? "TechCorp Solutions"
            : "StartupHub"

      console.log(`   • ${app.name}`)
      console.log(`     Organization: ${org}`)
      console.log(`     Type: ${app.type} (${app.platform})`)
      console.log(`     Client ID: ${app.clientId}`)
      console.log(`     Scopes: ${app.scopes.join(", ")}`)
      console.log(`     Rate Limits: ${app.rateLimits.requestsPerMinute}/min`)
      console.log("")
    }

    console.log("\n🎉 Database seeding completed successfully!")
    console.log("\n📋 Seeded data summary:")
    console.log(`   • 1 Super Admin: admin@clycites.com (password: SuperAdmin123!)`)
    console.log(`   • ${1 + additionalOrgs.length} Organizations (1 default + ${additionalOrgs.length} sample)`)
    console.log(`   • ${systemRoles.length} System Roles (ClyCites org)`)
    console.log(`   • ${sampleUsers.length} Sample Users`)
    console.log(`   • ${createdApplications.length} Sample Applications`)
    console.log(`   • Multiple organization memberships with different roles`)

    console.log("\n🔐 Login credentials:")
    console.log("   Super Admin: admin@clycites.com / SuperAdmin123!")
    console.log("   John Doe (Org Admin): john@example.com / Password123!")
    console.log("   Jane Smith (Team Manager): jane@example.com / Password123!")
    console.log("   Mike Johnson (Developer): mike@example.com / Password123!")
    console.log("   Sarah Wilson (Member): sarah@example.com / Password123!")

    console.log("\n🏢 Organizations:")
    console.log("   • ClyCites (Default) - Super Admin, John, Jane, Mike, Sarah")
    console.log("   • TechCorp Solutions - John (Owner), Mike, Sarah")
    console.log("   • StartupHub - Jane (Owner), John, Mike")

    console.log("\n📱 Applications:")
    console.log("   • ClyCites: Admin Dashboard, Mobile App, API Gateway")
    console.log("   • TechCorp Solutions: Client Portal, Analytics Dashboard, Mobile Workforce")
    console.log("   • StartupHub: Accelerator Platform, Mentor Connect, API Integration")

    console.log("\n🚀 You can now start the server and begin using the authentication system!")
    const PORT = process.env.PORT || 5000
    console.log(`📍 Server will run on: http://localhost:${PORT}`)
    console.log(`🔧 API Documentation: http://localhost:${PORT}/api-docs`)
    console.log(`🔐 Authentication endpoints: http://localhost:${PORT}/api/auth/*`)

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
      console.error("   - Check the error details above for specific field issues")
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
