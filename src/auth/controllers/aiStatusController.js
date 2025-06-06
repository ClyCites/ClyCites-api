import { aiServiceValidator } from "../services/aiServiceValidator.js"
import { asyncHandler } from "../utils/asyncHandler.js"
import { logger } from "../utils/logger.js" // Declare the logger variable

/**
 * Get AI service configuration status
 */
export const getAIStatus = asyncHandler(async (req, res) => {
  const status = aiServiceValidator.getConfigurationStatus()

  res.status(200).json({
    status: "success",
    data: {
      aiService: status,
      timestamp: new Date().toISOString(),
    },
  })
})

/**
 * Test AI service connectivity
 */
export const testAIService = asyncHandler(async (req, res) => {
  if (!aiServiceValidator.isAIEnabled()) {
    return res.status(400).json({
      status: "error",
      message: "AI service not configured",
      data: aiServiceValidator.getConfigurationStatus(),
    })
  }

  try {
    // Test with a simple prompt
    const { generateText } = await import("ai")
    const { openai } = await import("@ai-sdk/openai")

    const { text } = await generateText({
      model: openai("gpt-4o"),
      prompt: "Say 'AI service is working correctly' in exactly those words.",
      maxTokens: 20,
    })

    const isWorking = text.toLowerCase().includes("ai service is working correctly")

    res.status(200).json({
      status: "success",
      message: "AI service test completed",
      data: {
        configured: true,
        connected: isWorking,
        testResponse: text,
        timestamp: new Date().toISOString(),
      },
    })
  } catch (error) {
    logger.error("AI service test failed:", error)

    res.status(500).json({
      status: "error",
      message: "AI service test failed",
      data: {
        configured: true,
        connected: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      },
    })
  }
})
