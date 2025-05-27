import multer from "multer"
import path from "path"
import fs from "fs"
import { AppError } from "../utils/appError.js"

// Ensure upload directories exist
const ensureDirectoryExists = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true })
  }
}

// Configure storage for profile pictures
const profileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = "uploads/profiles"
    ensureDirectoryExists(uploadPath)
    cb(null, uploadPath)
  },
  filename: (req, file, cb) => {
    // Generate unique filename
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9)
    const extension = path.extname(file.originalname)
    cb(null, `profile-${req.user.id}-${uniqueSuffix}${extension}`)
  },
})

// File filter for profile pictures
const profileFileFilter = (req, file, cb) => {
  // Check file type
  const allowedTypes = /jpeg|jpg|png|gif|webp/
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase())
  const mimetype = allowedTypes.test(file.mimetype)

  if (mimetype && extname) {
    return cb(null, true)
  } else {
    cb(new AppError("Only image files (JPEG, JPG, PNG, GIF, WebP) are allowed", 400))
  }
}

// Configure multer for profile pictures
const uploadProfile = multer({
  storage: profileStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 1,
  },
  fileFilter: profileFileFilter,
})

// Middleware for uploading profile picture
export const uploadProfilePicture = (req, res, next) => {
  const upload = uploadProfile.single("profilePicture")

  upload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return next(new AppError("File too large. Maximum size is 5MB", 400))
      }
      if (err.code === "LIMIT_FILE_COUNT") {
        return next(new AppError("Too many files. Only one file allowed", 400))
      }
      if (err.code === "LIMIT_UNEXPECTED_FILE") {
        return next(new AppError('Unexpected field name. Use "profilePicture"', 400))
      }
      return next(new AppError(`Upload error: ${err.message}`, 400))
    } else if (err) {
      return next(err)
    }

    next()
  })
}

// Middleware for uploading multiple files (for future use)
export const uploadMultiple = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadPath = "uploads/documents"
      ensureDirectoryExists(uploadPath)
      cb(null, uploadPath)
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9)
      const extension = path.extname(file.originalname)
      cb(null, `doc-${uniqueSuffix}${extension}`)
    },
  }),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 5,
  },
  fileFilter: (req, file, cb) => {
    // Allow documents and images
    const allowedTypes = /jpeg|jpg|png|gif|webp|pdf|doc|docx|txt/
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase())
    const mimetype = /image\/|application\/pdf|application\/msword|text\//.test(file.mimetype)

    if (mimetype && extname) {
      return cb(null, true)
    } else {
      cb(new AppError("File type not allowed", 400))
    }
  },
}).array("documents", 5)

// Utility function to delete uploaded file
export const deleteUploadedFile = (filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }
  } catch (error) {
    console.error("Error deleting file:", error)
  }
}
