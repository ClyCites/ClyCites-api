import logger from "../utils/logger.js"

class AIServiceValidator {
  constructor() {
    this.isConfigured = false
    this.validateConfiguration()
  }

  validateConfiguration() {
    try {
      if (!process.env.OPENAI_API_KEY) {
        logger.warn("⚠️  OPENAI_API_KEY not found in environment variables")
        logger.warn("💡 AI recommendations will be disabled until API key is configured")
        logger.warn("🔑 Get your API key from: https://platform.openai.com/api-keys")
        this.isConfigured = false
        return false
      }

      // Validate API key format
      const apiKey = process.env.OPENAI_API_KEY
      if (!apiKey.startsWith("sk-") || apiKey.length < 20) {
        logger.error("❌ Invalid OPENAI_API_KEY format")
        logger.error("💡 API key should start with 'sk-' and be at least 20 characters long")
        this.isConfigured = false
        return false
      }

      this.isConfigured = true
      logger.info("✅ OpenAI API key configured successfully")
      return true
    } catch (error) {
      logger.error("❌ Error validating AI service configuration:", error)
      this.isConfigured = false
      return false
    }
  }

  isAIEnabled() {
    return this.isConfigured
  }

  getConfigurationStatus() {
    return {
      configured: this.isConfigured,
      provider: "OpenAI",
      model: "gpt-4o",
      features: this.isConfigured
        ? [
            "Weather-based recommendations",
            "Crop management advice",
            "Livestock care guidance",
            "Daily task generation",
            "Priority action suggestions",
            "Agricultural insights",
          ]
        : [],
      troubleshooting: this.isConfigured
        ? null
        : {
            issue: "OpenAI API key not configured",
            solution: "Add OPENAI_API_KEY to your environment variables",
            steps: [
              "1. Get API key from https://platform.openai.com/api-keys",
              "2. Add OPENAI_API_KEY=your_key_here to your .env file",
              "3. Restart the application",
            ],
          },
    }
  }
}

export const aiServiceValidator = new AIServiceValidator()
