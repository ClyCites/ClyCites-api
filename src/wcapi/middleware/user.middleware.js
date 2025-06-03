// Middleware to extract user information from headers
// This assumes your auth server passes user info via headers
export function extractUserInfo(req, res, next) {
  try {
    // Extract user information from headers set by your auth server
    const userId = req.headers["x-user-id"]
    const userEmail = req.headers["x-user-email"]
    const userPhone = req.headers["x-user-phone"]
    const userLanguage = req.headers["x-user-language"] || "en"

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User information not found in request headers",
      })
    }

    // Attach user info to request object
    req.user = {
      userId,
      email: userEmail,
      phone: userPhone,
      language: userLanguage,
    }

    next()
  } catch (error) {
    res.status(401).json({
      success: false,
      message: "Invalid user information",
    })
  }
}
