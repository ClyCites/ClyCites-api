import mongoose from "mongoose"

export const connectDB = async () => {
  try {
    // MongoDB Atlas connection options - updated for latest driver
    const options = {
      maxPoolSize: 10, // Maintain up to 10 socket connections
      serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
      family: 4, // Use IPv4, skip trying IPv6
      retryWrites: true,
      w: "majority",
    }

    const conn = await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/clycites-auth", options)

    console.log(`📦 MongoDB Atlas Connected: ${conn.connection.host}`)
    console.log(`📊 Database: ${conn.connection.name}`)

    // Log connection state
    mongoose.connection.on("connected", () => {
      console.log("📦 Mongoose connected to MongoDB Atlas")
    })

    mongoose.connection.on("error", (err) => {
      console.error(`📦 Mongoose connection error: ${err}`)
    })

    mongoose.connection.on("disconnected", () => {
      console.log("📦 Mongoose disconnected from MongoDB Atlas")
    })
  } catch (error) {
    console.error(`❌ Database connection error: ${error.message}`)

    // Log more details for debugging
    if (error.name === "MongoServerSelectionError") {
      console.error("💡 Check your MongoDB Atlas connection string and network access settings")
    }

    process.exit(1)
  }
}

// Graceful shutdown for cloud deployment
process.on("SIGINT", async () => {
  try {
    await mongoose.connection.close()
    console.log("📦 MongoDB Atlas connection closed through app termination")
    process.exit(0)
  } catch (error) {
    console.error("Error during graceful shutdown:", error)
    process.exit(1)
  }
})

// Handle process termination
process.on("SIGTERM", async () => {
  try {
    await mongoose.connection.close()
    console.log("📦 MongoDB Atlas connection closed through SIGTERM")
    process.exit(0)
  } catch (error) {
    console.error("Error during SIGTERM shutdown:", error)
    process.exit(1)
  }
})
