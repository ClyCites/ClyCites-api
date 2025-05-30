import { logger } from "../utils/logger.js"
import { ApiResponse } from "../utils/apiResponse.js"
import axios from "axios"

export const authMiddleware = async (req, res, next) => {
  try {
    let token;

    // Check for token in headers
    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
      token = req.headers.authorization.split(" ")[1];
    }

    // Check for API key in headers
    if (!token && req.headers["x-api-key"]) {
      token = req.headers["x-api-key"];
    }

    if (!token) {
      return res.status(401).json(ApiResponse.error("API token required"));
    }

    // Validate token with auth server
    const tokenValidation = await validateTokenWithAuthServer(token);

    if (!tokenValidation.success) {
      return res.status(401).json(ApiResponse.error(tokenValidation.message || "Invalid or expired API token"));
    }

    // ✅ Fix here
    req.user = { id: tokenValidation.data.id };
    req.organization = tokenValidation.data.organization;
    req.apiToken = tokenValidation.data.apiToken;

    next();
  } catch (error) {
    logger.error("Auth middleware error:", error);
    res.status(500).json(ApiResponse.error("Authentication error"));
  }
};


// Function to validate token with your auth server
export const validateTokenWithAuthServer = async (token) => {
  try {
    const response = await axios.post(
      `${process.env.AUTH_SERVER_URL}/api/auth/validate-token`,
      { token },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.JWT_SECRET}`,
        },
      }
    );

    const data = response.data;

    if (response.status !== 200 || !data.success) {
      return {
        success: false,
        message: data.message || "Token validation failed",
      };
    }

    return {
      success: true,
      data: data.data || data,
    };
  } catch (error) {
    logger.error("Auth server validation error:", error.message || error);
    return {
      success: false,
      message: "Auth server connection failed",
    };
  }
};


// Middleware to check API token scopes (matching your auth server pattern)
export const requireScope = (...requiredScopes) => {
  return (req, res, next) => {
    if (!req.apiToken) {
      return res.status(401).json(ApiResponse.error("API token required"))
    }

    // Check if apiToken has the hasScope method or check scopes array
    const hasRequiredScope = requiredScopes.some(scope => {
      if (req.apiToken.hasScope) {
        return req.apiToken.hasScope(scope)
      }
      // Fallback to checking scopes array
      return req.apiToken.scopes && req.apiToken.scopes.includes(scope)
    })

    if (!hasRequiredScope) {
      return res.status(403).json(
        ApiResponse.error(`Insufficient scope. Required: ${requiredScopes.join(" or ")}`)
      )
    }

    next()
  }
}

// Middleware to check API token permissions (matching your auth server pattern)
export const requirePermission = (resource, action) => {
  return (req, res, next) => {
    if (!req.apiToken) {
      return res.status(401).json(ApiResponse.error("API token required"))
    }

    // Check if apiToken has the hasPermission method
    const hasPermission = req.apiToken.hasPermission 
      ? req.apiToken.hasPermission(resource, action)
      : checkPermissionFallback(req.apiToken, resource, action)

    if (!hasPermission) {
      return res.status(403).json(
        ApiResponse.error(`Insufficient permissions for ${action} on ${resource}`)
      )
    }

    next()
  }
}

// Fallback permission check if hasPermission method is not available
const checkPermissionFallback = (apiToken, resource, action) => {
  if (!apiToken.permissions) return false
  
  const permission = `${resource}:${action}`
  return apiToken.permissions.includes(permission) || 
         apiToken.permissions.includes(`${resource}:*`) ||
         apiToken.permissions.includes("*:*")
}

// Organization-specific middleware
export const requireOrganization = (req, res, next) => {
  if (!req.organization) {
    return res.status(401).json(ApiResponse.error("Organization context required"))
  }

  if (!req.organization.isActive) {
    return res.status(401).json(ApiResponse.error("Organization is inactive"))
  }

  next()
}

// User-specific middleware
export const requireActiveUser = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json(ApiResponse.error("User context required"))
  }

  if (!req.user.isActive) {
    return res.status(401).json(ApiResponse.error("User account is inactive"))
  }

  next()
}
