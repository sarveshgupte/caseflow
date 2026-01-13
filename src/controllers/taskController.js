const Task = require('../models/Task');
const { wrapWriteHandler } = require('../utils/transactionGuards');

/**
 * Task Controller
 * Handles all task-related business logic
 */

/**
 * Get all tasks with filtering and pagination
 */
const getTasks = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      priority,
      assignedTo,
      case: caseId,
    } = req.query;
    
    const query = {};
    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (assignedTo) query.assignedTo = assignedTo;
    if (caseId) query.case = caseId;
    
    const tasks = await Task.find(query)
      .populate('assignedTo', 'name email')
      .populate('case', 'caseNumber title')
      .populate('createdBy', 'name email')
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .sort({ priority: -1, dueDate: 1, createdAt: -1 });
    
    const total = await Task.countDocuments(query);
    
    res.json({
      success: true,
      data: tasks,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error fetching tasks',
      message: error.message,
    });
  }
};

/**
 * Get single task by ID
 */
const getTaskById = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate('assignedTo', 'name email role')
      .populate('case', 'caseNumber title status')
      .populate('createdBy', 'name email')
      .populate('statusHistory.changedBy', 'name email');
    
    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found',
      });
    }
    
    res.json({
      success: true,
      data: task,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error fetching task',
      message: error.message,
    });
  }
};

/**
 * Create new task
 */
const createTask = async (req, res) => {
  try {
    const {
      title,
      description,
      status,
      priority,
      assignedTo,
      case: caseId,
      dueDate,
      estimatedHours,
      tags,
      createdBy,
    } = req.body;
    
    const task = new Task({
      title,
      description,
      status,
      priority,
      assignedTo,
      case: caseId,
      dueDate,
      estimatedHours,
      tags,
      createdBy, // In real app, this comes from auth
    });
    
    await task.save();
    await task.populate('assignedTo', 'name email');
    
    res.status(201).json({
      success: true,
      data: task,
      message: 'Task created successfully',
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: 'Error creating task',
      message: error.message,
    });
  }
};

/**
 * Update task
 */
const updateTask = async (req, res) => {
  try {
    const {
      title,
      description,
      status,
      priority,
      assignedTo,
      dueDate,
      estimatedHours,
      actualHours,
      tags,
      updatedBy,
    } = req.body;
    
    const task = await Task.findById(req.params.id);
    
    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found',
      });
    }
    
    if (title) task.title = title;
    if (description !== undefined) task.description = description;
    if (status) task.status = status;
    if (priority) task.priority = priority;
    if (assignedTo !== undefined) task.assignedTo = assignedTo;
    if (dueDate !== undefined) task.dueDate = dueDate;
    if (estimatedHours !== undefined) task.estimatedHours = estimatedHours;
    if (actualHours !== undefined) task.actualHours = actualHours;
    if (tags) task.tags = tags;
    task.updatedBy = updatedBy; // In real app, this comes from auth
    
    await task.save();
    await task.populate('assignedTo', 'name email');
    
    res.json({
      success: true,
      data: task,
      message: 'Task updated successfully',
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: 'Error updating task',
      message: error.message,
    });
  }
};

/**
 * Delete task
 */
const deleteTask = async (req, res) => {
  try {
    const task = await Task.findByIdAndDelete(req.params.id);
    
    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found',
      });
    }
    
    res.json({
      success: true,
      message: 'Task deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error deleting task',
      message: error.message,
    });
  }
};

/**
 * Get task statistics
 */
const getTaskStats = async (req, res) => {
  try {
    const stats = await Task.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);
    
    const priorityStats = await Task.aggregate([
      {
        $group: {
          _id: '$priority',
          count: { $sum: 1 },
        },
      },
    ]);
    
    res.json({
      success: true,
      data: {
        byStatus: stats,
        byPriority: priorityStats,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error fetching task statistics',
      message: error.message,
    });
  }
};

module.exports = {
  getTasks,
  getTaskById,
  createTask: wrapWriteHandler(createTask),
  updateTask: wrapWriteHandler(updateTask),
  deleteTask: wrapWriteHandler(deleteTask),
  getTaskStats,
};
