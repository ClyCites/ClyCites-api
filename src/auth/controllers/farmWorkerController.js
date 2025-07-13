import FarmWorker from "../models/farmWorkerModel.js"
import Farm from "../models/farmModel.js"
import OrganizationMember from "../models/organizationMemberModel.js"
import { AppError } from "../utils/appError.js"

// @desc    Create new farm worker
// @route   POST /api/farms/:farmId/workers
// @access  Private
export const createFarmWorker = async (req, res, next) => {
  try {
    const { farmId } = req.params
    const {
      name,
      email,
      phone,
      position,
      department,
      hireDate,
      salary,
      skills,
      certifications,
      emergencyContact,
      address,
      notes,
    } = req.body

    // Check if farm exists and user has access
    const farm = await Farm.findById(farmId)
    if (!farm) {
      return next(new AppError("Farm not found", 404))
    }

    const isOwner = farm.owner.toString() === req.user.id
    const membership = await OrganizationMember.findOne({
      user: req.user.id,
      organization: farm.organization,
      status: "active",
    })

    if (!isOwner && !membership) {
      return next(new AppError("Access denied", 403))
    }

    // Check if worker with email already exists
    const existingWorker = await FarmWorker.findOne({ farm: farmId, email })
    if (existingWorker) {
      return next(new AppError("Worker with this email already exists", 400))
    }

    const worker = await FarmWorker.create({
      farm: farmId,
      name,
      email,
      phone,
      position,
      department,
      hireDate,
      salary,
      skills,
      certifications,
      emergencyContact,
      address,
      notes,
      createdBy: req.user.id,
    })

    res.status(201).json({
      success: true,
      message: "Farm worker created successfully",
      data: worker,
    })
  } catch (error) {
    next(error)
  }
}

// @desc    Get all farm workers
// @route   GET /api/farms/:farmId/workers
// @access  Private
export const getFarmWorkers = async (req, res, next) => {
  try {
    const { farmId } = req.params
    const { department, position, status, page = 1, limit = 10 } = req.query

    // Check farm access
    const farm = await Farm.findById(farmId)
    if (!farm) {
      return next(new AppError("Farm not found", 404))
    }

    const isOwner = farm.owner.toString() === req.user.id
    const membership = await OrganizationMember.findOne({
      user: req.user.id,
      organization: farm.organization,
      status: "active",
    })

    if (!isOwner && !membership) {
      return next(new AppError("Access denied", 403))
    }

    // Build filter
    const filter = { farm: farmId }
    if (department) filter.department = department
    if (position) filter.position = position
    if (status) filter.status = status

    const skip = (page - 1) * limit
    const workers = await FarmWorker.find(filter)
      .populate("createdBy", "name email")
      .populate("assignedTasks.task")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number.parseInt(limit))

    const total = await FarmWorker.countDocuments(filter)

    res.status(200).json({
      success: true,
      message: "Farm workers retrieved successfully",
      data: {
        workers,
        pagination: {
          current: Number.parseInt(page),
          pages: Math.ceil(total / limit),
          total,
        },
      },
    })
  } catch (error) {
    next(error)
  }
}

// @desc    Get single farm worker
// @route   GET /api/farms/:farmId/workers/:workerId
// @access  Private
export const getFarmWorker = async (req, res, next) => {
  try {
    const { farmId, workerId } = req.params

    // Check farm access
    const farm = await Farm.findById(farmId)
    if (!farm) {
      return next(new AppError("Farm not found", 404))
    }

    const isOwner = farm.owner.toString() === req.user.id
    const membership = await OrganizationMember.findOne({
      user: req.user.id,
      organization: farm.organization,
      status: "active",
    })

    if (!isOwner && !membership) {
      return next(new AppError("Access denied", 403))
    }

    const worker = await FarmWorker.findOne({ _id: workerId, farm: farmId })
      .populate("createdBy", "name email")
      .populate("assignedTasks.task")
      .populate("performanceReviews.reviewedBy", "name")

    if (!worker) {
      return next(new AppError("Farm worker not found", 404))
    }

    res.status(200).json({
      success: true,
      message: "Farm worker retrieved successfully",
      data: worker,
    })
  } catch (error) {
    next(error)
  }
}

// @desc    Update farm worker
// @route   PUT /api/farms/:farmId/workers/:workerId
// @access  Private
export const updateFarmWorker = async (req, res, next) => {
  try {
    const { farmId, workerId } = req.params

    // Check farm access
    const farm = await Farm.findById(farmId)
    if (!farm) {
      return next(new AppError("Farm not found", 404))
    }

    const isOwner = farm.owner.toString() === req.user.id
    const membership = await OrganizationMember.findOne({
      user: req.user.id,
      organization: farm.organization,
      status: "active",
    })

    if (!isOwner && !membership) {
      return next(new AppError("Access denied", 403))
    }

    const worker = await FarmWorker.findOneAndUpdate(
      { _id: workerId, farm: farmId },
      { ...req.body, updatedBy: req.user.id },
      { new: true, runValidators: true },
    ).populate("createdBy", "name email")

    if (!worker) {
      return next(new AppError("Farm worker not found", 404))
    }

    res.status(200).json({
      success: true,
      message: "Farm worker updated successfully",
      data: worker,
    })
  } catch (error) {
    next(error)
  }
}

// @desc    Delete farm worker
// @route   DELETE /api/farms/:farmId/workers/:workerId
// @access  Private
export const deleteFarmWorker = async (req, res, next) => {
  try {
    const { farmId, workerId } = req.params

    // Check farm access
    const farm = await Farm.findById(farmId)
    if (!farm) {
      return next(new AppError("Farm not found", 404))
    }

    const isOwner = farm.owner.toString() === req.user.id
    const membership = await OrganizationMember.findOne({
      user: req.user.id,
      organization: farm.organization,
      status: "active",
    })

    if (!isOwner && !membership) {
      return next(new AppError("Access denied", 403))
    }

    const worker = await FarmWorker.findOneAndDelete({ _id: workerId, farm: farmId })

    if (!worker) {
      return next(new AppError("Farm worker not found", 404))
    }

    res.status(200).json({
      success: true,
      message: "Farm worker deleted successfully",
    })
  } catch (error) {
    next(error)
  }
}

// @desc    Record worker attendance
// @route   POST /api/farms/:farmId/workers/:workerId/attendance
// @access  Private
export const recordAttendance = async (req, res, next) => {
  try {
    const { farmId, workerId } = req.params
    const { date, status, checkIn, checkOut, hoursWorked, notes } = req.body

    // Check farm access
    const farm = await Farm.findById(farmId)
    if (!farm) {
      return next(new AppError("Farm not found", 404))
    }

    const isOwner = farm.owner.toString() === req.user.id
    const membership = await OrganizationMember.findOne({
      user: req.user.id,
      organization: farm.organization,
      status: "active",
    })

    if (!isOwner && !membership) {
      return next(new AppError("Access denied", 403))
    }

    const worker = await FarmWorker.findOne({ _id: workerId, farm: farmId })

    if (!worker) {
      return next(new AppError("Farm worker not found", 404))
    }

    // Check if attendance already exists for this date
    const existingAttendance = worker.attendance.find(
      (att) => att.date.toDateString() === new Date(date).toDateString(),
    )

    if (existingAttendance) {
      return next(new AppError("Attendance already recorded for this date", 400))
    }

    // Add attendance record
    worker.attendance.push({
      date: new Date(date),
      status,
      checkIn,
      checkOut,
      hoursWorked,
      notes,
      recordedBy: req.user.id,
    })

    await worker.save()

    res.status(200).json({
      success: true,
      message: "Attendance recorded successfully",
      data: worker,
    })
  } catch (error) {
    next(error)
  }
}

// @desc    Add performance review
// @route   POST /api/farms/:farmId/workers/:workerId/performance
// @access  Private
export const addPerformanceReview = async (req, res, next) => {
  try {
    const { farmId, workerId } = req.params
    const { period, rating, strengths, improvements, goals, comments } = req.body

    // Check farm access
    const farm = await Farm.findById(farmId)
    if (!farm) {
      return next(new AppError("Farm not found", 404))
    }

    const isOwner = farm.owner.toString() === req.user.id
    const membership = await OrganizationMember.findOne({
      user: req.user.id,
      organization: farm.organization,
      status: "active",
    })

    if (!isOwner && !membership) {
      return next(new AppError("Access denied", 403))
    }

    const worker = await FarmWorker.findOne({ _id: workerId, farm: farmId })

    if (!worker) {
      return next(new AppError("Farm worker not found", 404))
    }

    // Add performance review
    worker.performanceReviews.push({
      date: new Date(),
      period,
      rating,
      strengths,
      improvements,
      goals,
      comments,
      reviewedBy: req.user.id,
    })

    await worker.save()

    res.status(200).json({
      success: true,
      message: "Performance review added successfully",
      data: worker,
    })
  } catch (error) {
    next(error)
  }
}

// @desc    Get worker attendance report
// @route   GET /api/farms/:farmId/workers/:workerId/attendance-report
// @access  Private
export const getAttendanceReport = async (req, res, next) => {
  try {
    const { farmId, workerId } = req.params
    const { startDate, endDate } = req.query

    // Check farm access
    const farm = await Farm.findById(farmId)
    if (!farm) {
      return next(new AppError("Farm not found", 404))
    }

    const isOwner = farm.owner.toString() === req.user.id
    const membership = await OrganizationMember.findOne({
      user: req.user.id,
      organization: farm.organization,
      status: "active",
    })

    if (!isOwner && !membership) {
      return next(new AppError("Access denied", 403))
    }

    const worker = await FarmWorker.findOne({ _id: workerId, farm: farmId })

    if (!worker) {
      return next(new AppError("Farm worker not found", 404))
    }

    // Filter attendance by date range
    let attendance = worker.attendance
    if (startDate && endDate) {
      const start = new Date(startDate)
      const end = new Date(endDate)
      attendance = attendance.filter((att) => att.date >= start && att.date <= end)
    }

    // Calculate statistics
    const totalDays = attendance.length
    const presentDays = attendance.filter((att) => att.status === "present").length
    const absentDays = attendance.filter((att) => att.status === "absent").length
    const lateDays = attendance.filter((att) => att.status === "late").length
    const totalHours = attendance.reduce((sum, att) => sum + (att.hoursWorked || 0), 0)

    const report = {
      worker: {
        name: worker.name,
        position: worker.position,
        department: worker.department,
      },
      period: {
        startDate: startDate || attendance[0]?.date,
        endDate: endDate || attendance[attendance.length - 1]?.date,
      },
      statistics: {
        totalDays,
        presentDays,
        absentDays,
        lateDays,
        totalHours,
        attendanceRate: totalDays > 0 ? ((presentDays / totalDays) * 100).toFixed(2) : 0,
      },
      attendance,
    }

    res.status(200).json({
      success: true,
      message: "Attendance report generated successfully",
      data: report,
    })
  } catch (error) {
    next(error)
  }
}

export default {
  createFarmWorker,
  getFarmWorkers,
  getFarmWorker,
  updateFarmWorker,
  deleteFarmWorker,
  recordAttendance,
  addPerformanceReview,
  getAttendanceReport,
}
