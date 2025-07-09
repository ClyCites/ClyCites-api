import asyncHandler from "../utils/asyncHandler.js"
import FarmWorker from "../models/farmWorkerModel.js"
import Farm from "../models/farmModel.js"
import { AppError } from "../utils/appError.js"

// @desc    Get all farm workers
// @route   GET /api/farms/:farmId/workers
// @access  Private
export const getFarmWorkers = asyncHandler(async (req, res) => {
  const { farmId } = req.params
  const { status, department, skill } = req.query

  // Verify farm ownership
  const farm = await Farm.findOne({ _id: farmId, owner: req.user._id })
  if (!farm) {
    throw new AppError("Farm not found or access denied", 404)
  }

  const query = { farm: farmId }

  // Apply filters
  if (status) query.status = status
  if (department) query.department = department
  if (skill) query.skills = { $in: [skill] }

  const workers = await FarmWorker.find(query).populate("supervisor", "firstName lastName").sort({ createdAt: -1 })

  // Calculate summary statistics
  const activeWorkers = workers.filter((worker) => worker.status === "active").length
  const totalSalary = workers.reduce((sum, worker) => sum + worker.salary, 0)
  const avgPerformance =
    workers.length > 0 ? workers.reduce((sum, worker) => sum + worker.performanceRating, 0) / workers.length : 0

  res.status(200).json({
    status: "success",
    results: workers.length,
    data: {
      workers,
      summary: {
        totalWorkers: workers.length,
        activeWorkers,
        totalSalary,
        averagePerformance: avgPerformance.toFixed(2),
      },
    },
  })
})

// @desc    Add new farm worker
// @route   POST /api/farms/:farmId/workers
// @access  Private
export const addFarmWorker = asyncHandler(async (req, res) => {
  const { farmId } = req.params

  // Verify farm ownership
  const farm = await Farm.findOne({ _id: farmId, owner: req.user._id })
  if (!farm) {
    throw new AppError("Farm not found or access denied", 404)
  }

  const workerData = {
    ...req.body,
    farm: farmId,
    addedBy: req.user._id,
  }

  const worker = await FarmWorker.create(workerData)
  await worker.populate("supervisor", "firstName lastName")

  res.status(201).json({
    status: "success",
    data: { worker },
  })
})

// @desc    Get single farm worker
// @route   GET /api/workers/:workerId
// @access  Private
export const getFarmWorker = asyncHandler(async (req, res) => {
  const worker = await FarmWorker.findById(req.params.workerId)
    .populate("farm", "name")
    .populate("supervisor", "firstName lastName email")
    .populate("addedBy", "firstName lastName")

  if (!worker) {
    throw new AppError("Worker not found", 404)
  }

  // Verify access through farm ownership
  const farm = await Farm.findOne({ _id: worker.farm._id, owner: req.user._id })
  if (!farm) {
    throw new AppError("Access denied", 403)
  }

  res.status(200).json({
    status: "success",
    data: { worker },
  })
})

// @desc    Update farm worker
// @route   PUT /api/workers/:workerId
// @access  Private
export const updateFarmWorker = asyncHandler(async (req, res) => {
  const worker = await FarmWorker.findById(req.params.workerId)

  if (!worker) {
    throw new AppError("Worker not found", 404)
  }

  // Verify access through farm ownership
  const farm = await Farm.findOne({ _id: worker.farm, owner: req.user._id })
  if (!farm) {
    throw new AppError("Access denied", 403)
  }

  Object.assign(worker, req.body)
  worker.lastUpdated = new Date()

  await worker.save()
  await worker.populate("supervisor", "firstName lastName")

  res.status(200).json({
    status: "success",
    data: { worker },
  })
})

// @desc    Record worker attendance
// @route   POST /api/workers/:workerId/attendance
// @access  Private
export const recordAttendance = asyncHandler(async (req, res) => {
  const { date, status, hoursWorked, notes } = req.body
  const worker = await FarmWorker.findById(req.params.workerId)

  if (!worker) {
    throw new AppError("Worker not found", 404)
  }

  // Verify access through farm ownership
  const farm = await Farm.findOne({ _id: worker.farm, owner: req.user._id })
  if (!farm) {
    throw new AppError("Access denied", 403)
  }

  // Check if attendance already exists for this date
  const existingAttendance = worker.attendance.find((att) => att.date.toDateString() === new Date(date).toDateString())

  if (existingAttendance) {
    throw new AppError("Attendance already recorded for this date", 400)
  }

  // Record attendance
  worker.attendance.push({
    date: new Date(date),
    status,
    hoursWorked: hoursWorked || 0,
    notes,
    recordedBy: req.user._id,
  })

  worker.lastUpdated = new Date()
  await worker.save()

  res.status(200).json({
    status: "success",
    message: "Attendance recorded successfully",
    data: { worker },
  })
})

// @desc    Assign task to worker
// @route   POST /api/workers/:workerId/tasks
// @access  Private
export const assignTask = asyncHandler(async (req, res) => {
  const { title, description, priority, dueDate, estimatedHours } = req.body
  const worker = await FarmWorker.findById(req.params.workerId)

  if (!worker) {
    throw new AppError("Worker not found", 404)
  }

  // Verify access through farm ownership
  const farm = await Farm.findOne({ _id: worker.farm, owner: req.user._id })
  if (!farm) {
    throw new AppError("Access denied", 403)
  }

  // Assign task
  worker.tasks.push({
    title,
    description,
    priority: priority || "medium",
    status: "pending",
    assignedDate: new Date(),
    dueDate: dueDate ? new Date(dueDate) : null,
    estimatedHours: estimatedHours || 0,
    assignedBy: req.user._id,
  })

  worker.lastUpdated = new Date()
  await worker.save()

  res.status(200).json({
    status: "success",
    message: "Task assigned successfully",
    data: { worker },
  })
})

// @desc    Update task status
// @route   PUT /api/workers/:workerId/tasks/:taskId
// @access  Private
export const updateTaskStatus = asyncHandler(async (req, res) => {
  const { status, actualHours, notes } = req.body
  const worker = await FarmWorker.findById(req.params.workerId)

  if (!worker) {
    throw new AppError("Worker not found", 404)
  }

  // Verify access through farm ownership
  const farm = await Farm.findOne({ _id: worker.farm, owner: req.user._id })
  if (!farm) {
    throw new AppError("Access denied", 403)
  }

  const task = worker.tasks.id(req.params.taskId)
  if (!task) {
    throw new AppError("Task not found", 404)
  }

  task.status = status
  if (actualHours) task.actualHours = actualHours
  if (notes) task.notes = notes
  if (status === "completed") task.completedDate = new Date()

  worker.lastUpdated = new Date()
  await worker.save()

  res.status(200).json({
    status: "success",
    message: "Task updated successfully",
    data: { worker },
  })
})

// @desc    Get worker analytics
// @route   GET /api/farms/:farmId/workers/analytics
// @access  Private
export const getWorkerAnalytics = asyncHandler(async (req, res) => {
  const { farmId } = req.params
  const { period = "30" } = req.query

  // Verify farm ownership
  const farm = await Farm.findOne({ _id: farmId, owner: req.user._id })
  if (!farm) {
    throw new AppError("Farm not found or access denied", 404)
  }

  const workers = await FarmWorker.find({ farm: farmId })

  // Calculate analytics
  const totalWorkers = workers.length
  const activeWorkers = workers.filter((w) => w.status === "active").length
  const totalSalary = workers.reduce((sum, w) => sum + w.salary, 0)
  const avgPerformance =
    workers.length > 0 ? workers.reduce((sum, w) => sum + w.performanceRating, 0) / workers.length : 0

  // Department breakdown
  const departmentBreakdown = workers.reduce((acc, worker) => {
    if (!acc[worker.department]) {
      acc[worker.department] = { count: 0, totalSalary: 0 }
    }
    acc[worker.department].count++
    acc[worker.department].totalSalary += worker.salary
    return acc
  }, {})

  // Attendance analysis (last 30 days)
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - Number.parseInt(period))

  const attendanceStats = workers.map((worker) => {
    const recentAttendance = worker.attendance.filter((att) => new Date(att.date) >= thirtyDaysAgo)
    const totalDays = recentAttendance.length
    const presentDays = recentAttendance.filter((att) => att.status === "present").length
    const totalHours = recentAttendance.reduce((sum, att) => sum + att.hoursWorked, 0)

    return {
      workerId: worker._id,
      name: `${worker.firstName} ${worker.lastName}`,
      department: worker.department,
      attendanceRate: totalDays > 0 ? ((presentDays / totalDays) * 100).toFixed(2) : 0,
      totalHours,
      averageHours: totalDays > 0 ? (totalHours / totalDays).toFixed(2) : 0,
    }
  })

  // Task completion analysis
  const taskStats = workers.map((worker) => {
    const completedTasks = worker.tasks.filter((task) => task.status === "completed").length
    const pendingTasks = worker.tasks.filter((task) => task.status === "pending").length
    const overdueTasks = worker.tasks.filter(
      (task) => task.status !== "completed" && task.dueDate && new Date(task.dueDate) < new Date(),
    ).length

    return {
      workerId: worker._id,
      name: `${worker.firstName} ${worker.lastName}`,
      completedTasks,
      pendingTasks,
      overdueTasks,
      completionRate: worker.tasks.length > 0 ? ((completedTasks / worker.tasks.length) * 100).toFixed(2) : 0,
    }
  })

  res.status(200).json({
    status: "success",
    data: {
      summary: {
        totalWorkers,
        activeWorkers,
        totalSalary,
        averagePerformance: avgPerformance.toFixed(2),
        averageSalary: totalWorkers > 0 ? (totalSalary / totalWorkers).toFixed(2) : 0,
      },
      departmentBreakdown,
      attendanceStats,
      taskStats,
      recommendations: [
        ...(activeWorkers < totalWorkers ? [`${totalWorkers - activeWorkers} workers are inactive`] : []),
        ...(avgPerformance < 3 ? ["Average performance is below expectations"] : []),
        ...(attendanceStats.filter((stat) => stat.attendanceRate < 80).length > 0
          ? [`${attendanceStats.filter((stat) => stat.attendanceRate < 80).length} workers have low attendance`]
          : []),
      ],
    },
  })
})

// @desc    Delete farm worker
// @route   DELETE /api/workers/:workerId
// @access  Private
export const deleteFarmWorker = asyncHandler(async (req, res) => {
  const worker = await FarmWorker.findById(req.params.workerId)

  if (!worker) {
    throw new AppError("Worker not found", 404)
  }

  // Verify access through farm ownership
  const farm = await Farm.findOne({ _id: worker.farm, owner: req.user._id })
  if (!farm) {
    throw new AppError("Access denied", 403)
  }

  await worker.deleteOne()

  res.status(200).json({
    status: "success",
    message: "Worker deleted successfully",
  })
})
