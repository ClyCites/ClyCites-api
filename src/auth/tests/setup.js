import { MongoMemoryServer } from "mongodb-memory-server"
import mongoose from "mongoose"
import { jest, beforeAll, afterEach, afterAll } from "@jest/globals"

let mongoServer

// Setup before all tests
beforeAll(async () => {
  // Start in-memory MongoDB instance
  mongoServer = await MongoMemoryServer.create()
  const mongoUri = mongoServer.getUri()

  // Connect to the in-memory database
  await mongoose.connect(mongoUri)

  // Mock console methods to reduce test output noise
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }
})

// Cleanup after each test
afterEach(async () => {
  const collections = mongoose.connection.collections
  for (const key in collections) {
    const collection = collections[key]
    await collection.deleteMany({})
  }
})

// Cleanup after all tests
afterAll(async () => {
  await mongoose.connection.dropDatabase()
  await mongoose.connection.close()
  await mongoServer.stop()
})

// Global test timeout
jest.setTimeout(30000)

// Mock environment variables
process.env.NODE_ENV = "test"
process.env.JWT_SECRET = "test-jwt-secret-key-for-testing-purposes-only"
process.env.JWT_REFRESH_SECRET = "test-refresh-secret-key-for-testing-purposes-only"
process.env.JWT_EXPIRE = "15m"
process.env.JWT_REFRESH_EXPIRE = "7d"
process.env.CLIENT_URL = "http://localhost:3000"
process.env.EMAIL_USERNAME = "test@example.com"
process.env.EMAIL_PASSWORD = "test-password"
