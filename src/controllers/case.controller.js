const Case = require('../models/Case.model');
const Comment = require('../models/Comment.model');
const Attachment = require('../models/Attachment.model');
const CaseHistory = require('../models/CaseHistory.model');
const fs = require('fs').promises;
const path = require('path');

/**
 * Case Controller for Core Case APIs
 * Handles case creation, comments, attachments, cloning, unpending, and status updates
 */

/**
 * Create a new case
 * POST /api/cases
 */
const createCase = async (req, res) => {
  try {
    const {
      title,
      description,
      category,
      clientName,
      createdBy,
      priority,
      assignedTo,
    } = req.body;
    
    // Validate required fields
    if (!title) {
      return res.status(400).json({
        success: false,
        message: 'Title is required',
      });
    }
    
    if (!category) {
      return res.status(400).json({
        success: false,
        message: 'Category is required',
      });
    }
    
    if (!clientName) {
      return res.status(400).json({
        success: false,
        message: 'Client name is required',
      });
    }
    
    if (!createdBy) {
      return res.status(400).json({
        success: false,
        message: 'Created by email is required',
      });
    }
    
    // Create new case with defaults
    const newCase = new Case({
      title,
      description,
      category,
      clientName,
      createdBy: createdBy.toLowerCase(),
      priority: priority || 'Medium',
      status: 'Open',
      assignedTo: assignedTo ? assignedTo.toLowerCase() : null,
    });
    
    await newCase.save();
    
    // Create case history entry
    await CaseHistory.create({
      caseId: newCase.caseId,
      actionType: 'Created',
      description: `Case created with status: Open`,
      performedBy: createdBy.toLowerCase(),
    });
    
    res.status(201).json({
      success: true,
      data: newCase,
      message: 'Case created successfully',
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Error creating case',
      error: error.message,
    });
  }
};

/**
 * Add a comment to a case
 * POST /api/cases/:caseId/comments
 */
const addComment = async (req, res) => {
  try {
    const { caseId } = req.params;
    const { text, createdBy, note } = req.body;
    
    // Validate required fields
    if (!text) {
      return res.status(400).json({
        success: false,
        message: 'Comment text is required',
      });
    }
    
    if (!createdBy) {
      return res.status(400).json({
        success: false,
        message: 'Created by email is required',
      });
    }
    
    // Check if case exists
    const caseData = await Case.findOne({ caseId });
    
    if (!caseData) {
      return res.status(404).json({
        success: false,
        message: 'Case not found',
      });
    }
    
    // Check if case status allows comments
    const allowedStatuses = ['Open', 'Pending', 'Closed', 'Filed'];
    if (!allowedStatuses.includes(caseData.status)) {
      return res.status(400).json({
        success: false,
        message: `Comments cannot be added to cases with status: ${caseData.status}`,
      });
    }
    
    // Create comment
    const comment = await Comment.create({
      caseId,
      text,
      createdBy: createdBy.toLowerCase(),
      note,
    });
    
    res.status(201).json({
      success: true,
      data: comment,
      message: 'Comment added successfully',
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Error adding comment',
      error: error.message,
    });
  }
};

/**
 * Upload an attachment to a case
 * POST /api/cases/:caseId/attachments
 * Uses multer middleware for file upload
 */
const addAttachment = async (req, res) => {
  try {
    const { caseId } = req.params;
    const { description, createdBy, note } = req.body;
    
    // Validate file upload
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'File is required',
      });
    }
    
    // Validate required fields
    if (!description) {
      return res.status(400).json({
        success: false,
        message: 'Description is required',
      });
    }
    
    if (!createdBy) {
      return res.status(400).json({
        success: false,
        message: 'Created by email is required',
      });
    }
    
    // Check if case exists
    const caseData = await Case.findOne({ caseId });
    
    if (!caseData) {
      return res.status(404).json({
        success: false,
        message: 'Case not found',
      });
    }
    
    // Check if case status allows attachments
    if (caseData.status === 'Filed') {
      return res.status(400).json({
        success: false,
        message: 'Attachments cannot be added to Filed cases',
      });
    }
    
    const allowedStatuses = ['Open', 'Pending', 'Closed'];
    if (!allowedStatuses.includes(caseData.status)) {
      return res.status(400).json({
        success: false,
        message: `Attachments cannot be added to cases with status: ${caseData.status}`,
      });
    }
    
    // Create attachment record
    const attachment = await Attachment.create({
      caseId,
      fileName: req.file.originalname,
      filePath: req.file.path,
      description,
      createdBy: createdBy.toLowerCase(),
      note,
    });
    
    res.status(201).json({
      success: true,
      data: attachment,
      message: 'Attachment uploaded successfully',
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Error uploading attachment',
      error: error.message,
    });
  }
};

/**
 * Clone a case with all comments and attachments
 * POST /api/cases/:caseId/clone
 */
const cloneCase = async (req, res) => {
  try {
    const { caseId } = req.params;
    const { newCategory, assignedTo, clonedBy } = req.body;
    
    // Validate required fields
    if (!newCategory) {
      return res.status(400).json({
        success: false,
        message: 'New category is required',
      });
    }
    
    if (!clonedBy) {
      return res.status(400).json({
        success: false,
        message: 'Cloned by email is required',
      });
    }
    
    // Find original case
    const originalCase = await Case.findOne({ caseId });
    
    if (!originalCase) {
      return res.status(404).json({
        success: false,
        message: 'Original case not found',
      });
    }
    
    // Check if case can be cloned
    if (originalCase.status === 'Archived') {
      return res.status(400).json({
        success: false,
        message: 'Archived cases cannot be cloned',
      });
    }
    
    // Create new case
    const newCase = new Case({
      title: originalCase.title,
      description: originalCase.description,
      category: newCategory,
      clientName: originalCase.clientName,
      priority: originalCase.priority,
      status: 'Open',
      pendingUntil: null,
      createdBy: clonedBy.toLowerCase(),
      assignedTo: assignedTo ? assignedTo.toLowerCase() : null,
    });
    
    await newCase.save();
    
    // Copy comments
    const originalComments = await Comment.find({ caseId: originalCase.caseId });
    const copiedComments = [];
    
    for (const comment of originalComments) {
      const newComment = await Comment.create({
        caseId: newCase.caseId,
        text: comment.text,
        createdBy: comment.createdBy,
        note: `Cloned from Case ID: ${originalCase.caseId}`,
      });
      copiedComments.push(newComment);
    }
    
    // Copy attachments (including actual files)
    const originalAttachments = await Attachment.find({ caseId: originalCase.caseId });
    const copiedAttachments = [];
    
    for (const attachment of originalAttachments) {
      try {
        // Create new file path for cloned attachment
        const originalPath = attachment.filePath;
        const fileExt = path.extname(attachment.fileName);
        const newFileName = `${Date.now()}-${Math.random().toString(36).substring(7)}${fileExt}`;
        const newFilePath = path.join('uploads', newFileName);
        
        // Copy the actual file
        await fs.copyFile(originalPath, newFilePath);
        
        // Create new attachment record
        const newAttachment = await Attachment.create({
          caseId: newCase.caseId,
          fileName: attachment.fileName,
          filePath: newFilePath,
          description: attachment.description,
          createdBy: attachment.createdBy,
          note: `Cloned from Case ID: ${originalCase.caseId}`,
        });
        copiedAttachments.push(newAttachment);
      } catch (fileError) {
        console.error(`Error copying file for attachment: ${fileError.message}`);
        // Continue with other attachments even if one fails
      }
    }
    
    // Create history entries
    // For original case
    await CaseHistory.create({
      caseId: originalCase.caseId,
      actionType: 'Cloned',
      description: `Cloned to ${newCase.caseId}`,
      performedBy: clonedBy.toLowerCase(),
    });
    
    // For new case
    await CaseHistory.create({
      caseId: newCase.caseId,
      actionType: 'Created (Cloned)',
      description: `Cloned from ${originalCase.caseId}`,
      performedBy: clonedBy.toLowerCase(),
    });
    
    res.status(201).json({
      success: true,
      data: {
        originalCaseId: originalCase.caseId,
        newCase,
        copiedComments: copiedComments.length,
        copiedAttachments: copiedAttachments.length,
      },
      message: 'Case cloned successfully',
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Error cloning case',
      error: error.message,
    });
  }
};

/**
 * Unpend a case
 * POST /api/cases/:caseId/unpend
 */
const unpendCase = async (req, res) => {
  try {
    const { caseId } = req.params;
    const { comment, performedBy } = req.body;
    
    // Validate required fields
    if (!comment) {
      return res.status(400).json({
        success: false,
        message: 'Comment is required',
      });
    }
    
    if (!performedBy) {
      return res.status(400).json({
        success: false,
        message: 'Performed by email is required',
      });
    }
    
    // Find case
    const caseData = await Case.findOne({ caseId });
    
    if (!caseData) {
      return res.status(404).json({
        success: false,
        message: 'Case not found',
      });
    }
    
    // Check if case is in Pending status
    if (caseData.status !== 'Pending') {
      return res.status(400).json({
        success: false,
        message: 'Only Pending cases can be unpended',
      });
    }
    
    // Update case status
    caseData.status = 'Open';
    caseData.assignedTo = null;
    caseData.pendingUntil = null;
    
    await caseData.save();
    
    // Create comment
    await Comment.create({
      caseId,
      text: comment,
      createdBy: performedBy.toLowerCase(),
    });
    
    // Create history entry
    await CaseHistory.create({
      caseId,
      actionType: 'Unpended',
      description: `Case unpended with comment: ${comment}`,
      performedBy: performedBy.toLowerCase(),
    });
    
    res.json({
      success: true,
      data: caseData,
      message: 'Case unpended successfully',
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Error unpending case',
      error: error.message,
    });
  }
};

/**
 * Update case status
 * PUT /api/cases/:caseId/status
 */
const updateCaseStatus = async (req, res) => {
  try {
    const { caseId } = req.params;
    const { status, performedBy, pendingUntil } = req.body;
    
    // Validate required fields
    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required',
      });
    }
    
    if (!performedBy) {
      return res.status(400).json({
        success: false,
        message: 'Performed by email is required',
      });
    }
    
    // Find case
    const caseData = await Case.findOne({ caseId });
    
    if (!caseData) {
      return res.status(404).json({
        success: false,
        message: 'Case not found',
      });
    }
    
    const oldStatus = caseData.status;
    
    // Update status
    caseData.status = status;
    
    // Handle Pending status - require pendingUntil
    if (status === 'Pending' && !pendingUntil) {
      return res.status(400).json({
        success: false,
        message: 'pendingUntil date is required when status is Pending',
      });
    }
    
    if (status === 'Pending') {
      caseData.pendingUntil = pendingUntil;
    }
    
    await caseData.save();
    
    // Create history entry
    await CaseHistory.create({
      caseId,
      actionType: 'StatusChanged',
      description: `Status changed from ${oldStatus} to ${status}`,
      performedBy: performedBy.toLowerCase(),
    });
    
    res.json({
      success: true,
      data: caseData,
      message: 'Case status updated successfully',
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Error updating case status',
      error: error.message,
    });
  }
};

/**
 * Get case by caseId
 * GET /api/cases/:caseId
 */
const getCaseByCaseId = async (req, res) => {
  try {
    const { caseId } = req.params;
    
    const caseData = await Case.findOne({ caseId });
    
    if (!caseData) {
      return res.status(404).json({
        success: false,
        message: 'Case not found',
      });
    }
    
    // Get related data
    const comments = await Comment.find({ caseId }).sort({ createdAt: 1 });
    const attachments = await Attachment.find({ caseId }).sort({ createdAt: 1 });
    const history = await CaseHistory.find({ caseId }).sort({ timestamp: -1 });
    
    res.json({
      success: true,
      data: {
        case: caseData,
        comments,
        attachments,
        history,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching case',
      error: error.message,
    });
  }
};

/**
 * Get all cases with filtering
 * GET /api/cases
 */
const getCases = async (req, res) => {
  try {
    const {
      status,
      category,
      priority,
      assignedTo,
      createdBy,
      page = 1,
      limit = 20,
    } = req.query;
    
    const query = {};
    if (status) query.status = status;
    if (category) query.category = category;
    if (priority) query.priority = priority;
    if (assignedTo) query.assignedTo = assignedTo.toLowerCase();
    if (createdBy) query.createdBy = createdBy.toLowerCase();
    
    const cases = await Case.find(query)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .sort({ createdAt: -1 });
    
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
      message: 'Error fetching cases',
      error: error.message,
    });
  }
};

/**
 * Lock a case
 * POST /api/cases/:caseId/lock
 */
const lockCaseEndpoint = async (req, res) => {
  try {
    const { caseId } = req.params;
    const { userEmail } = req.body;
    
    if (!userEmail) {
      return res.status(400).json({
        success: false,
        message: 'User email is required',
      });
    }
    
    const caseData = await Case.findOne({ caseId });
    
    if (!caseData) {
      return res.status(404).json({
        success: false,
        message: 'Case not found',
      });
    }
    
    // Check if already locked by another user
    if (caseData.lockStatus.isLocked && 
        caseData.lockStatus.activeUserEmail !== userEmail.toLowerCase()) {
      return res.status(409).json({
        success: false,
        message: `Case is currently locked by ${caseData.lockStatus.activeUserEmail}`,
        lockedBy: caseData.lockStatus.activeUserEmail,
        lockedAt: caseData.lockStatus.lockedAt,
      });
    }
    
    // Lock the case
    caseData.lockStatus = {
      isLocked: true,
      activeUserEmail: userEmail.toLowerCase(),
      lockedAt: Date.now(),
    };
    
    await caseData.save();
    
    res.json({
      success: true,
      data: caseData,
      message: 'Case locked successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error locking case',
      error: error.message,
    });
  }
};

/**
 * Unlock a case
 * POST /api/cases/:caseId/unlock
 */
const unlockCaseEndpoint = async (req, res) => {
  try {
    const { caseId } = req.params;
    const { userEmail } = req.body;
    
    if (!userEmail) {
      return res.status(400).json({
        success: false,
        message: 'User email is required',
      });
    }
    
    const caseData = await Case.findOne({ caseId });
    
    if (!caseData) {
      return res.status(404).json({
        success: false,
        message: 'Case not found',
      });
    }
    
    // Check if locked by this user
    if (caseData.lockStatus.isLocked && 
        caseData.lockStatus.activeUserEmail !== userEmail.toLowerCase()) {
      return res.status(403).json({
        success: false,
        message: 'You can only unlock cases that you have locked',
      });
    }
    
    // Unlock the case
    caseData.lockStatus = {
      isLocked: false,
      activeUserEmail: null,
      lockedAt: null,
    };
    
    await caseData.save();
    
    res.json({
      success: true,
      data: caseData,
      message: 'Case unlocked successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error unlocking case',
      error: error.message,
    });
  }
};

module.exports = {
  createCase,
  addComment,
  addAttachment,
  cloneCase,
  unpendCase,
  updateCaseStatus,
  getCaseByCaseId,
  getCases,
  lockCaseEndpoint,
  unlockCaseEndpoint,
};
