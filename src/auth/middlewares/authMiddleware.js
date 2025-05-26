import jwt from 'jsonwebtoken';
import User from '../models/userModel.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/appError.js';

// Protect routes - verify JWT token
export const protect = asyncHandler(async (req, res, next) => {
  let token;

  // Check for token in headers
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  // Check for token in cookies
  if (!token && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return next(new AppError('Access denied. No token provided.', 401));
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get user from token
    const user = await User.findById(decoded.id);

    if (!user) {
      return next(new AppError('The user belonging to this token no longer exists', 401));
    }

    // Check if user is active
    if (!user.isActive) {
      return next(new AppError('Your account has been deactivated. Please contact support.', 401));
    }

    // Check if account is locked
    if (user.isLocked) {
      return next(new AppError('Account temporarily locked due to too many failed login attempts', 401));
    }

    // Grant access to protected route
    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return next(new AppError('Invalid token', 401));
    } else if (error.name === 'TokenExpiredError') {
      return next(new AppError('Token expired', 401));
    } else {
      return next(new AppError('Token verification failed', 401));
    }
  }
});

// Grant access to specific roles
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(new AppError(`User role '${req.user.role}' is not authorized to access this route`, 403));
    }
    next();
  };
};

// Optional authentication - doesn't fail if no token
export const optionalAuth = asyncHandler(async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token && req.cookies.token) {
    token = req.cookies.token;
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id);
      
      if (user && user.isActive && !user.isLocked) {
        req.user = user;
      }
    } catch (error) {
      // Silently fail for optional auth
    }
  }

  next();
});

// Check if user owns resource or is admin
export const ownerOrAdmin = (resourceUserField = 'user') => {
  return (req, res, next) => {
    if (req.user.role === 'admin') {
      return next();
    }

    // Check if user owns the resource
    const resourceUserId = req.resource ? req.resource[resourceUserField] : req.params.userId;
    
    if (req.user.id !== resourceUserId?.toString()) {
      return next(new AppError('Access denied. You can only access your own resources.', 403));
    }

    next();
  };
};

// Rate limiting for sensitive operations
export const sensitiveOperationLimit = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id);
  const now = new Date();
  const oneHour = 60 * 60 * 1000;

  // Check if user has made too many sensitive operations in the last hour
  const recentOperations = user.sensitiveOperations?.filter(
    op => now - op.timestamp < oneHour
  ) || [];

  if (recentOperations.length >= 5) {
    return next(new AppError('Too many sensitive operations. Please try again later.', 429));
  }

  // Add current operation to user's record
  if (!user.sensitiveOperations) {
    user.sensitiveOperations = [];
  }
  
  user.sensitiveOperations.push({ timestamp: now });
  
  // Keep only last 10 operations
  if (user.sensitiveOperations.length > 10) {
    user.sensitiveOperations = user.sensitiveOperations.slice(-10);
  }

  await user.save({ validateBeforeSave: false });
  next();
});
