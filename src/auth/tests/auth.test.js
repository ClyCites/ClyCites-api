import request from "supertest"
import app from "../app.js"
import User from "../models/userModel.js"
import jwt from "jsonwebtoken"

describe("Authentication Endpoints", () => {
  describe("POST /api/auth/register", () => {
    const validUser = {
      username: "testuser",
      email: "test@example.com",
      password: "TestPass123!",
      firstName: "Test",
      lastName: "User",
    }

    it("should register a new user successfully", async () => {
      const res = await request(app).post("/api/auth/register").send(validUser).expect(201)

      expect(res.body.success).toBe(true)
      expect(res.body.message).toContain("registered successfully")
      expect(res.body.data.user.email).toBe(validUser.email)
      expect(res.body.data.user.username).toBe(validUser.username)
      expect(res.body.data.user).not.toHaveProperty("password")
    })

    it("should not register user with invalid email", async () => {
      const invalidUser = { ...validUser, email: "invalid-email" }

      const res = await request(app).post("/api/auth/register").send(invalidUser).expect(400)

      expect(res.body.success).toBe(false)
      expect(res.body.message).toContain("Validation failed")
    })

    it("should not register user with weak password", async () => {
      const weakPasswordUser = { ...validUser, password: "123" }

      const res = await request(app).post("/api/auth/register").send(weakPasswordUser).expect(400)

      expect(res.body.success).toBe(false)
    })

    it("should not register user with duplicate email", async () => {
      // Create first user
      await request(app).post("/api/auth/register").send(validUser)

      // Try to create second user with same email
      const duplicateUser = { ...validUser, username: "different" }

      const res = await request(app).post("/api/auth/register").send(duplicateUser).expect(400)

      expect(res.body.success).toBe(false)
      expect(res.body.message).toContain("already exists")
    })
  })

  describe("POST /api/auth/login", () => {
    let user

    beforeEach(async () => {
      // Create and verify a user for login tests
      user = await User.create({
        username: "loginuser",
        email: "login@example.com",
        password: "LoginPass123!",
        firstName: "Login",
        lastName: "User",
        isEmailVerified: true,
      })
    })

    it("should login with valid credentials", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({
          identifier: "login@example.com",
          password: "LoginPass123!",
        })
        .expect(200)

      expect(res.body.success).toBe(true)
      expect(res.body.message).toContain("Login successful")
      expect(res.body.data.token).toBeDefined()
      expect(res.body.data.refreshToken).toBeDefined()
      expect(res.body.data.user.email).toBe("login@example.com")
    })

    it("should login with username", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({
          identifier: "loginuser",
          password: "LoginPass123!",
        })
        .expect(200)

      expect(res.body.success).toBe(true)
      expect(res.body.data.user.username).toBe("loginuser")
    })

    it("should not login with invalid password", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({
          identifier: "login@example.com",
          password: "wrongpassword",
        })
        .expect(401)

      expect(res.body.success).toBe(false)
      expect(res.body.message).toContain("Invalid credentials")
    })

    it("should not login with unverified email", async () => {
      // Create unverified user
      await User.create({
        username: "unverified",
        email: "unverified@example.com",
        password: "UnverifiedPass123!",
        firstName: "Unverified",
        lastName: "User",
        isEmailVerified: false,
      })

      const res = await request(app)
        .post("/api/auth/login")
        .send({
          identifier: "unverified@example.com",
          password: "UnverifiedPass123!",
        })
        .expect(401)

      expect(res.body.success).toBe(false)
      expect(res.body.message).toContain("verify your email")
    })

    it("should not login non-existent user", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({
          identifier: "nonexistent@example.com",
          password: "SomePass123!",
        })
        .expect(401)

      expect(res.body.success).toBe(false)
    })
  })

  describe("GET /api/auth/me", () => {
    let user
    let token

    beforeEach(async () => {
      user = await User.create({
        username: "meuser",
        email: "me@example.com",
        password: "MePass123!",
        firstName: "Me",
        lastName: "User",
        isEmailVerified: true,
      })

      token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "1h" })
    })

    it("should get current user with valid token", async () => {
      const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`).expect(200)

      expect(res.body.success).toBe(true)
      expect(res.body.data.user.email).toBe("me@example.com")
      expect(res.body.data.user.username).toBe("meuser")
      expect(res.body.data.user).not.toHaveProperty("password")
    })

    it("should not get user without token", async () => {
      const res = await request(app).get("/api/auth/me").expect(401)

      expect(res.body.success).toBe(false)
      expect(res.body.message).toContain("No token provided")
    })

    it("should not get user with invalid token", async () => {
      const res = await request(app).get("/api/auth/me").set("Authorization", "Bearer invalid-token").expect(401)

      expect(res.body.success).toBe(false)
      expect(res.body.message).toContain("Invalid token")
    })
  })

  describe("POST /api/auth/refresh-token", () => {
    let user
    let refreshToken

    beforeEach(async () => {
      user = await User.create({
        username: "refreshuser",
        email: "refresh@example.com",
        password: "RefreshPass123!",
        firstName: "Refresh",
        lastName: "User",
        isEmailVerified: true,
      })

      refreshToken = jwt.sign({ id: user._id }, process.env.JWT_REFRESH_SECRET, { expiresIn: "7d" })

      // Add refresh token to user
      const crypto = await import("crypto")
      const hashedToken = crypto.default.createHash("sha256").update(refreshToken).digest("hex")
      user.refreshTokens.push({ token: hashedToken })
      await user.save()
    })

    it("should refresh token with valid refresh token", async () => {
      const res = await request(app).post("/api/auth/refresh-token").send({ refreshToken }).expect(200)

      expect(res.body.success).toBe(true)
      expect(res.body.data.token).toBeDefined()
      expect(res.body.message).toContain("refreshed successfully")
    })

    it("should not refresh with invalid token", async () => {
      const res = await request(app)
        .post("/api/auth/refresh-token")
        .send({ refreshToken: "invalid-refresh-token" })
        .expect(401)

      expect(res.body.success).toBe(false)
      expect(res.body.message).toContain("Invalid refresh token")
    })

    it("should not refresh without token", async () => {
      const res = await request(app).post("/api/auth/refresh-token").send({}).expect(401)

      expect(res.body.success).toBe(false)
      expect(res.body.message).toContain("not provided")
    })
  })

  describe("POST /api/auth/forgot-password", () => {
    let user

    beforeEach(async () => {
      user = await User.create({
        username: "forgotuser",
        email: "forgot@example.com",
        password: "ForgotPass123!",
        firstName: "Forgot",
        lastName: "User",
        isEmailVerified: true,
      })
    })

    it("should send password reset email for existing user", async () => {
      const res = await request(app).post("/api/auth/forgot-password").send({ email: "forgot@example.com" }).expect(200)

      expect(res.body.success).toBe(true)
      expect(res.body.message).toContain("reset email sent")

      // Check if reset token was set
      const updatedUser = await User.findById(user._id)
      expect(updatedUser.passwordResetToken).toBeDefined()
      expect(updatedUser.passwordResetExpires).toBeDefined()
    })

    it("should return error for non-existent email", async () => {
      const res = await request(app)
        .post("/api/auth/forgot-password")
        .send({ email: "nonexistent@example.com" })
        .expect(404)

      expect(res.body.success).toBe(false)
      expect(res.body.message).toContain("No user found")
    })
  })

  describe("Authorization Middleware", () => {
    let adminUser, editorUser, viewerUser
    let adminToken, editorToken, viewerToken

    beforeEach(async () => {
      adminUser = await User.create({
        username: "admin",
        email: "admin@example.com",
        password: "AdminPass123!",
        firstName: "Admin",
        lastName: "User",
        role: "admin",
        isEmailVerified: true,
      })

      editorUser = await User.create({
        username: "editor",
        email: "editor@example.com",
        password: "EditorPass123!",
        firstName: "Editor",
        lastName: "User",
        role: "editor",
        isEmailVerified: true,
      })

      viewerUser = await User.create({
        username: "viewer",
        email: "viewer@example.com",
        password: "ViewerPass123!",
        firstName: "Viewer",
        lastName: "User",
        role: "viewer",
        isEmailVerified: true,
      })

      adminToken = jwt.sign({ id: adminUser._id }, process.env.JWT_SECRET, { expiresIn: "1h" })
      editorToken = jwt.sign({ id: editorUser._id }, process.env.JWT_SECRET, { expiresIn: "1h" })
      viewerToken = jwt.sign({ id: viewerUser._id }, process.env.JWT_SECRET, { expiresIn: "1h" })
    })

    it("should allow admin to access admin routes", async () => {
      const res = await request(app).get("/api/auth/users").set("Authorization", `Bearer ${adminToken}`).expect(200)

      expect(res.body.success).toBe(true)
      expect(res.body.data.users).toBeDefined()
    })

    it("should not allow editor to access admin routes", async () => {
      const res = await request(app).get("/api/auth/users").set("Authorization", `Bearer ${editorToken}`).expect(403)

      expect(res.body.success).toBe(false)
      expect(res.body.message).toContain("not authorized")
    })

    it("should not allow viewer to access admin routes", async () => {
      const res = await request(app).get("/api/auth/users").set("Authorization", `Bearer ${viewerToken}`).expect(403)

      expect(res.body.success).toBe(false)
      expect(res.body.message).toContain("not authorized")
    })
  })

  describe("Account Security", () => {
    let user

    beforeEach(async () => {
      user = await User.create({
        username: "securityuser",
        email: "security@example.com",
        password: "SecurityPass123!",
        firstName: "Security",
        lastName: "User",
        isEmailVerified: true,
      })
    })

    it("should lock account after multiple failed login attempts", async () => {
      // Make 5 failed login attempts
      for (let i = 0; i < 5; i++) {
        await request(app).post("/api/auth/login").send({
          identifier: "security@example.com",
          password: "wrongpassword",
        })
      }

      // 6th attempt should return account locked message
      const res = await request(app)
        .post("/api/auth/login")
        .send({
          identifier: "security@example.com",
          password: "wrongpassword",
        })
        .expect(401)

      expect(res.body.message).toContain("locked")
    })
  })
})

describe("User Model", () => {
  describe("Password Hashing", () => {
    it("should hash password before saving", async () => {
      const user = new User({
        username: "hashtest",
        email: "hash@example.com",
        password: "PlainPassword123!",
        firstName: "Hash",
        lastName: "Test",
      })

      await user.save()
      expect(user.password).not.toBe("PlainPassword123!")
      expect(user.password.length).toBeGreaterThan(50) // bcrypt hash length
    })

    it("should validate correct password", async () => {
      const user = await User.create({
        username: "validatetest",
        email: "validate@example.com",
        password: "ValidatePass123!",
        firstName: "Validate",
        lastName: "Test",
      })

      const isMatch = await user.matchPassword("ValidatePass123!")
      expect(isMatch).toBe(true)
    })

    it("should reject incorrect password", async () => {
      const user = await User.create({
        username: "rejecttest",
        email: "reject@example.com",
        password: "RejectPass123!",
        firstName: "Reject",
        lastName: "Test",
      })

      const isMatch = await user.matchPassword("WrongPassword123!")
      expect(isMatch).toBe(false)
    })
  })

  describe("Validation", () => {
    it("should require username", async () => {
      const user = new User({
        email: "test@example.com",
        password: "TestPass123!",
        firstName: "Test",
        lastName: "User",
      })

      await expect(user.save()).rejects.toThrow()
    })

    it("should require valid email format", async () => {
      const user = new User({
        username: "testuser",
        email: "invalid-email",
        password: "TestPass123!",
        firstName: "Test",
        lastName: "User",
      })

      await expect(user.save()).rejects.toThrow()
    })

    it("should enforce minimum password length", async () => {
      const user = new User({
        username: "testuser",
        email: "test@example.com",
        password: "123",
        firstName: "Test",
        lastName: "User",
      })

      await expect(user.save()).rejects.toThrow()
    })
  })
})
