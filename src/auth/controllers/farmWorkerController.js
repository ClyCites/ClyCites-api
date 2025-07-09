import { validationResult } from "express-validator"
import FarmWorker from "../models/farmWorkerModel.js"
import Farm from "../models/farmModel.js"
import OrganizationMember from "../models/organizationMemberModel.js"
import DailyTask from "../models/dailyTaskModel.js"
import { asyncHandler } from "../utils/asyncHandler.js"
import { AppError } from "../utils/appError.js"

// @desc    Create farm worker
// @route   POST /api/farms/:farmId/workers
// @access  Private (Farm owner or org member)
export const createFarmWorker = asyncHandler(async (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return next(new AppError("Validation failed", 400, errors.array()))
  }

  const farmId = req.params.farmId
  const { personalInfo, employment, skills, healthSafety, notes, metadata } = req.body

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

  // Generate employee ID if not provided
  if (!employment.employeeId) {
    const workerCount = await FarmWorker.countDocuments({ farm: farmId })
    employment.employeeId = `${farm.name.substring(0, 3).toUpperCase()}${String(workerCount + 1).padStart(3, "0")}`
  }

  const worker = await FarmWorker.create({
    farm: farmId,
    personalInfo,
    employment,
    skills: skills || [],
    healthSafety: healthSafety || {},
    notes,
    metadata: metadata || {},
  })

  res.status(201).json({
    success: true,
    message: "Farm worker created successfully",
    data: { worker },
  })
})

// @desc    Get farm workers
// @route   GET /api/farms/:farmId/workers
// @access  Private (Farm owner or org member)
export const getFarmWorkers = asyncHandler(async (req, res, next) => {
  const farmId = req.params.farmId
  const { position, status = "active", page = 1, limit = 20 } = req.query

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

  const skip = (Number.parseInt(page) - 1) * Number.parseInt(limit)
  const query = { farm: farmId, status }

  if (position) {
    query["employment.position"] = position
  }

  const workers = await FarmWorker.find(query).sort({ createdAt: -1 }).skip(skip).limit(Number.parseInt(limit))

  const total = await FarmWorker.countDocuments(query)

  // Add calculated fields
  const workersWithCalculations = workers.map((worker) => ({
    ...worker.toObject(),
    fullName: worker.fullName,
    age: worker.age,
    yearsOfService: worker.yearsOfService,
    currentMonthAttendance: worker.currentMonthAttendance,
    activeTasks: worker.activeTasks.length,
    monthlyTasksCompleted: worker.monthlyTasksCompleted,
  }))

  res.status(200).json({
    success: true,
    data: {
      workers: workersWithCalculations,
      pagination: {
        page: Number.parseInt(page),
        limit: Number.parseInt(limit),
        total,
        pages: Math.ceil(total / Number.parseInt(limit)),
      },
    },
  })
})

// @desc    Get worker details
// @route   GET /api/workers/:workerId
// @access  Private (Farm owner or org member)
export const getWorkerDetails = asyncHandler(async (req, res, next) => {
  const workerId = req.params.workerId

  const worker = await FarmWorker.findById(workerId)
    .populate("farm", "name owner organization")
    .populate("tasks.task", "title category priority status")
    .populate("performance.reviews.reviewer", "firstName lastName")

  if (!worker) {
    return next(new AppError("Worker not found", 404))
  }

  // Check permissions
  const isOwner = worker.farm.owner.toString() === req.user.id
  const membership = await OrganizationMember.findOne({
    user: req.user.id,
    organization: worker.farm.organization,
    status: "active",
  })

  if (!isOwner && !membership) {
    return next(new AppError("Access denied", 403))
  }

  const workerWithCalculations = {
    ...worker.toObject(),
    fullName: worker.fullName,
    age: worker.age,
    yearsOfService: worker.yearsOfService,
    currentMonthAttendance: worker.currentMonthAttendance,
    activeTasks: worker.activeTasks,
    monthlyTasksCompleted: worker.monthlyTasksCompleted,
  }

  res.status(200).json({
    success: true,
    data: { worker: workerWithCalculations },
  })
})

// @desc    Update farm worker
// @route   PUT /api/workers/:workerId
// @access  Private (Farm owner or org member)
export const updateFarmWorker = asyncHandler(async (req, res, next) => {
  const workerId = req.params.workerId

  const worker = await FarmWorker.findById(workerId).populate("farm")
  if (!worker) {
    return next(new AppError("Worker not found", 404))
  }

  // Check permissions
  const isOwner = worker.farm.owner.toString() === req.user.id
  const membership = await OrganizationMember.findOne({
    user: req.user.id,
    organization: worker.farm.organization,
    status: "active",
  })

  if (!isOwner && !membership) {
    return next(new AppError("Access denied", 403))
  }

  const allowedFields = ["personalInfo", "employment", "skills", "healthSafety", "status", "notes", "metadata"]

  const updates = {}
  allowedFields.forEach((field) => {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field]
    }
  })

  const updatedWorker = await FarmWorker.findByIdAndUpdate(workerId, updates, {
    new: true,
    runValidators: true,
  })

  res.status(200).json({
    success: true,
    message: "Worker updated successfully",
    data: { worker: updatedWorker },
  })
})

// @desc    Record attendance
// @route   POST /api/workers/:workerId/attendance
// @access  Private (Farm owner or org member)
export const recordAttendance = asyncHandler(async (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return next(new AppError("Validation failed", 400, errors.array()))
  }

  const workerId = req.params.workerId
  const { date, checkIn, checkOut, status, notes } = req.body

  const worker = await FarmWorker.findById(workerId).populate("farm")
  if (!worker) {
    return next(new AppError("Worker not found", 404))
  }

  // Check permissions
  const isOwner = worker.farm.owner.toString() === req.user.id
  const membership = await OrganizationMember.findOne({
    user: req.user.id,
    organization: worker.farm.organization,
    status: "active",
  })

  if (!isOwner && !membership) {
    return next(new AppError("Access denied", 403))
  }

  // Calculate hours worked
  let hoursWorked = 0
  if (checkIn && checkOut) {
    const checkInTime = new Date(checkIn)
    const checkOutTime = new Date(checkOut)
    hoursWorked = (checkOutTime - checkInTime) / (1000 * 60 * 60) // Convert to hours
  }

  const attendanceData = {
    date: new Date(date),
    checkIn: checkIn ? new Date(checkIn) : undefined,
    checkOut: checkOut ? new Date(checkOut) : undefined,
    hoursWorked,
    status: status || "present",
    notes,
  }

  await worker.recordAttendance(attendanceData)

  res.status(201).json({
    success: true,
    message: "Attendance recorded successfully",
    data: { attendance: attendanceData },
  })
})

// @desc    Assign task to worker
// @route   POST /api/workers/:workerId/tasks
// @access  Private (Farm owner or org member)
export const assignTask = asyncHandler(async (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return next(new AppError("Validation failed", 400, errors.array()))
  }

  const workerId = req.params.workerId
  const { taskId } = req.body

  const worker = await FarmWorker.findById(workerId).populate("farm")
  if (!worker) {
    return next(new AppError("Worker not found", 404))
  }

  // Check permissions
  const isOwner = worker.farm.owner.toString() === req.user.id
  const membership = await OrganizationMember.findOne({
    user: req.user.id,
    organization: worker.farm.organization,
    status: "active",
  })

  if (!isOwner && !membership) {
    return next(new AppError("Access denied", 403))
  }

  // Verify task exists and belongs to the same farm
  const task = await DailyTask.findById(taskId)
  if (!task || task.farm.toString() !== worker.farm._id.toString()) {
    return next(new AppError("Task not found or access denied", 404))
  }

  await worker.assignTask(taskId)

  res.status(200).json({
    success: true,
    message: "Task assigned successfully",
    data: {
      worker: { id: worker._id, name: worker.fullName },
      task: { id: task._id, title: task.title },
    },
  })
})

// @desc    Complete task
// @route   PUT /api/workers/:workerId/tasks/:taskId/complete
// @access  Private (Farm owner or org member)
export const completeTask = asyncHandler(async (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return next(new AppError("Validation failed", 400, errors.array()))
  }

  const { workerId, taskId } = req.params
  const { quality, feedback } = req.body

  const worker = await FarmWorker.findById(workerId).populate("farm")
  if (!worker) {
    return next(new AppError("Worker not found", 404))
  }

  // Check permissions
  const isOwner = worker.farm.owner.toString() === req.user.id
  const membership = await OrganizationMember.findOne({
    user: req.user.id,
    organization: worker.farm.organization,
    status: "active",
  })

  if (!isOwner && !membership) {
    return next(new AppError("Access denied", 403))
  }

  await worker.completeTask(taskId, quality, feedback)

  // Update the actual task status
  await DailyTask.findByIdAndUpdate(taskId, { status: "completed" })

  res.status(200).json({
    success: true,
    message: "Task completed successfully",
    data: {
      worker: { id: worker._id, name: worker.fullName },
      task: { id: taskId, quality, feedback },
    },
  })
})

// @desc    Add performance review
// @route   POST /api/workers/:workerId/reviews
// @access  Private (Farm owner or org member)
export const addPerformanceReview = asyncHandler(async (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return next(new AppError("Validation failed", 400, errors.array()))
  }

  const workerId = req.params.workerId
  const { rating, strengths, improvements, goals, comments } = req.body

  const worker = await FarmWorker.findById(workerId).populate("farm")
  if (!worker) {
    return next(new AppError("Worker not found", 404))
  }

  // Check permissions
  const isOwner = worker.farm.owner.toString() === req.user.id
  const membership = await OrganizationMember.findOne({
    user: req.user.id,
    organization: worker.farm.organization,
    status: "active",
  })

  if (!isOwner && !membership) {
    return next(new AppError("Access denied", 403))
  }

  const reviewData = {
    date: new Date(),
    reviewer: req.user.id,
    rating: Number.parseInt(rating),
    strengths: strengths || [],
    improvements: improvements || [],
    goals: goals || [],
    comments,
  }

  await worker.addPerformanceReview(reviewData)

  res.status(201).json({
    success: true,
    message: "Performance review added successfully",
    data: { review: reviewData },
  })
})

// @desc    Get worker performance report
// @route   GET /api/farms/:farmId/workers/performance
// @access  Private (Farm owner or org member)
export const getPerformanceReport = asyncHandler(async (req, res, next) => {
  const farmId = req.params.farmId
  const { startDate, endDate, period = "month" } = req.query

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

  let start, end
  if (startDate && endDate) {
    start = new Date(startDate)
    end = new Date(endDate)
  } else {
    end = new Date()
    switch (period) {
      case "week":
        start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case "month":
        start = new Date(end.getFullYear(), end.getMonth() - 1, end.getDate())
        break
      case "quarter":
        start = new Date(end.getFullYear(), end.getMonth() - 3, end.getDate())
        break
      default:
        start = new Date(end.getFullYear(), end.getMonth() - 1, end.getDate())
    }
  }

  const performanceReport = await FarmWorker.getPerformanceReport(farmId, start, end)

  // Get additional statistics
  const [totalWorkers, activeWorkers, avgRating] = await Promise.all([
    FarmWorker.countDocuments({ farm: farmId }),
    FarmWorker.countDocuments({ farm: farmId, status: "active" }),
    FarmWorker.aggregate([
      { $match: { farm: farmId, status: "active" } },
      { $group: { _id: null, avgRating: { $avg: "$performance.currentRating" } } },
    ]),
  ])

  res.status(200).json({
    success: true,
    data: {
      period: { start, end, type: period },
      summary: {
        totalWorkers,
        activeWorkers,
        averageRating: avgRating[0]?.avgRating || 0,
        totalTasksCompleted: performanceReport.reduce((sum, worker) => sum + worker.tasksCompleted, 0),
        averageTasksPerWorker:
          performanceReport.length > 0
            ? performanceReport.reduce((sum, worker) => sum + worker.tasksCompleted, 0) / performanceReport.length
            : 0,
      },
      workers: performanceReport,
    },
  })
})

// @desc    Calculate monthly salary
// @route   GET /api/workers/:workerId/salary/:month/:year
// @access  Private (Farm owner or org member)
export const calculateMonthlySalary = asyncHandler(async (req, res, next) => {
  const { workerId, month, year } = req.params

  const worker = await FarmWorker.findById(workerId).populate("farm")
  if (!worker) {
    return next(new AppError("Worker not found", 404))
  }

  // Check permissions
  const isOwner = worker.farm.owner.toString() === req.user.id
  const membership = await OrganizationMember.findOne({
    user: req.user.id,
    organization: worker.farm.organization,
    status: "active",
  })

  if (!isOwner && !membership) {
    return next(new AppError("Access denied", 403))
  }

  const salaryCalculation = worker.calculateMonthlySalary(Number.parseInt(month), Number.parseInt(year))

  res.status(200).json({
    success: true,
    data: {
      worker: {
        id: worker._id,
        name: worker.fullName,
        position: worker.employment.position,
      },
      period: { month: Number.parseInt(month), year: Number.parseInt(year) },
      salary: salaryCalculation,
    },
  })
})

export default {
  createFarmWorker,
  getFarmWorkers,
  getWorkerDetails,
  updateFarmWorker,
  recordAttendance,
  assignTask,
  completeTask,
  addPerformanceReview,
  getPerformanceReport,
  calculateMonthlySalary,
}
