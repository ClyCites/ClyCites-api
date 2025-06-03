import type { Request, Response, NextFunction } from "express"
import jwt from "jsonwebtoken"
import { User } from "../models/user.model"

export interface AuthRequest extends Request {
  user?: {
    userId: string
    email: string
  }
}

export async function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "")

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Access denied. No token provided.",
      })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || "your-secret-key") as any

    // Verify user still exists
    const user = await User.findById(decoded.userId)
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid token. User not found.",
      })
    }

    req.user = {
      userId: decoded.userId,
      email: decoded.email,
    }

    next()
  } catch (error) {
    res.status(401).json({
      success: false,
      message: "Invalid token.",
    })
  }
}
