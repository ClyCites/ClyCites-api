// Import dotenv to load .env variables
import dotenv from "dotenv";
dotenv.config();

import logger from "../utils/logger.js";

class AIServiceValidator {
  constructor() {
    this.isConfigured = false;
    this.validateConfiguration();
  }

  validateConfiguration() {
    try {
      const apiKey = process.env.OPENAI_API_KEY;

      // Debug logging
      logger.info("🔍 Checking OpenAI API Key...");
      if (!apiKey) {
        logger.warn("⚠️  OPENAI_API_KEY is undefined or missing from environment variables");
        logger.warn("💡 AI features will be disabled until it's properly configured");
        logger.warn("🔑 Get your API key from: https://platform.openai.com/api-keys");
        this.isConfigured = false;
        return false;
      }

      // Format validation (support both old and new key prefixes)
      if (
        (!apiKey.startsWith("sk-") && !apiKey.startsWith("sk-proj-")) ||
        apiKey.length < 20
      ) {
        logger.error("❌ Invalid OPENAI_API_KEY format");
        logger.error("💡 API key should start with 'sk-' or 'sk-proj-' and be at least 20 characters long");
        this.isConfigured = false;
        return false;
      }

      // All checks passed
      this.isConfigured = true;
      logger.info("✅ OpenAI API key configured successfully");
      return true;
    } catch (error) {
      logger.error("❌ Error validating AI service configuration:", error);
      this.isConfigured = false;
      return false;
    }
  }

  isAIEnabled() {
    return this.isConfigured;
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
    };
  }
}

// Export a singleton instance
export const aiServiceValidator = new AIServiceValidator();
