const Case = require('../models/Case.model');
const Task = require('../models/Task');
const { CaseRepository } = require('../repositories');

/**
 * Case Controller
 * Handles all case-related business logic
 */

/**
 * Get all cases with filtering and pagination
 */
const getCases = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      priority,
      leadConsultant,
    } = req.query;
    const firmId = req.firmId;
    
    if (!firmId) {
      return res.status(400).json({
        success: false,
        error: 'Firm context missing',
      });
    }
    
    const query = { firmId };
    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (leadConsultant) query.leadConsultant = leadConsultant;
    
    const cases = await Case.find(query)
      .populate('leadConsultant', 'name email')
      .populate('assignedTeam', 'name email')
      .populate('createdBy', 'name email')
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .sort({ priority: -1, createdAt: -1 });
    
    const total = await Case.countDocuments(query);
    
    res.json({
      success: true,
      data: cases,
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
      error: 'Error fetching cases',
      message: error.message,
    });
  }
};

/**
 * Get single case by ID with related tasks
 */
const getCaseById = async (req, res) => {
  try {
    const firmId = req.firmId;
    const caseData = await Case.findOne({ _id: req.params.id, ...(firmId ? { firmId } : {}) })
      .populate('leadConsultant', 'name email role')
      .populate('assignedTeam', 'name email role')
      .populate('createdBy', 'name email')
      .populate('statusHistory.changedBy', 'name email')
      .populate('notes.createdBy', 'name email');
    
    if (!caseData) {
      return res.status(404).json({
        success: false,
        error: 'Case not found',
      });
    }
    
    // Get related tasks
    const tasks = await Task.find({ case: req.params.id, firmId })
      .populate('assignedTo', 'name email')
      .sort({ priority: -1, dueDate: 1 });
    
    res.json({
      success: true,
      data: {
        ...caseData.toObject(),
        tasks,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error fetching case',
      message: error.message,
    });
  }
};

/**
 * Create new case
 */
const createCase = async (req, res) => {
  try {
    const {
      caseNumber,
      title,
      description,
      status,
      priority,
      client,
      assignedTeam,
      leadConsultant,
      startDate,
      targetCloseDate,
      estimatedBudget,
      tags,
      createdBy,
    } = req.body;
    
    // Check if case number already exists
    const existingCase = await Case.findOne({ caseNumber });
    if (existingCase) {
      return res.status(400).json({
        success: false,
        error: 'Case with this case number already exists',
      });
    }
    
    const caseData = new Case({
      caseNumber,
      title,
      description,
      status,
      priority,
      client,
      assignedTeam,
      leadConsultant,
      startDate,
      targetCloseDate,
      estimatedBudget,
      tags,
      createdBy, // In real app, this comes from auth
    });
    
    await caseData.save();
    await caseData.populate('leadConsultant', 'name email');
    await caseData.populate('assignedTeam', 'name email');
    
    res.status(201).json({
      success: true,
      data: caseData,
      message: 'Case created successfully',
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: 'Error creating case',
      message: error.message,
    });
  }
};

/**
 * Update case
 */
const updateCase = async (req, res) => {
  try {
    const {
      title,
      description,
      status,
      priority,
      client,
      assignedTeam,
      leadConsultant,
      targetCloseDate,
      estimatedBudget,
      actualCost,
      tags,
      updatedBy,
    } = req.body;
    
    const caseData = await Case.findById(req.params.id);
    
    if (!caseData) {
      return res.status(404).json({
        success: false,
        error: 'Case not found',
      });
    }
    
    if (title) caseData.title = title;
    if (description !== undefined) caseData.description = description;
    if (status) caseData.status = status;
    if (priority) caseData.priority = priority;
    if (client) caseData.client = { ...caseData.client, ...client };
    if (assignedTeam) caseData.assignedTeam = assignedTeam;
    if (leadConsultant !== undefined) caseData.leadConsultant = leadConsultant;
    if (targetCloseDate !== undefined) caseData.targetCloseDate = targetCloseDate;
    if (estimatedBudget !== undefined) caseData.estimatedBudget = estimatedBudget;
    if (actualCost !== undefined) caseData.actualCost = actualCost;
    if (tags) caseData.tags = tags;
    caseData.updatedBy = updatedBy; // In real app, this comes from auth
    
    await caseData.save();
    await caseData.populate('leadConsultant', 'name email');
    await caseData.populate('assignedTeam', 'name email');
    
    res.json({
      success: true,
      data: caseData,
      message: 'Case updated successfully',
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: 'Error updating case',
      message: error.message,
    });
  }
};

/**
 * Delete case (only if no tasks exist)
 */
const deleteCase = async (req, res) => {
  try {
    const caseData = await Case.findById(req.params.id);
    
    if (!caseData) {
      return res.status(404).json({
        success: false,
        error: 'Case not found',
      });
    }
    
    // Check if case has tasks
    const taskCount = await Task.countDocuments({ case: req.params.id });
    if (taskCount > 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete case with existing tasks',
      });
    }
    
    await Case.findByIdAndDelete(req.params.id);
    
    res.json({
      success: true,
      message: 'Case deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error deleting case',
      message: error.message,
    });
  }
};

/**
 * Add note to case
 */
const addCaseNote = async (req, res) => {
  try {
    const { content, createdBy } = req.body;
    
    const caseData = await Case.findById(req.params.id);
    
    if (!caseData) {
      return res.status(404).json({
        success: false,
        error: 'Case not found',
      });
    }
    
    caseData.notes.push({
      content,
      createdBy, // In real app, this comes from auth
    });
    
    await caseData.save();
    await caseData.populate('notes.createdBy', 'name email');
    
    res.json({
      success: true,
      data: caseData,
      message: 'Note added successfully',
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: 'Error adding note',
      message: error.message,
    });
  }
};

/**
 * Get case statistics
 */
const getCaseStats = async (req, res) => {
  try {
    const stats = await Case.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalBudget: { $sum: '$estimatedBudget' },
        },
      },
    ]);
    
    const priorityStats = await Case.aggregate([
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
      error: 'Error fetching case statistics',
      message: error.message,
    });
  }
};

module.exports = {
  getCases,
  getCaseById,
  createCase,
  updateCase,
  deleteCase,
  addCaseNote,
  getCaseStats,
};
