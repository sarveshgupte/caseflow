const Case = require('../models/Case.model');
const Comment = require('../models/Comment.model');
const Attachment = require('../models/Attachment.model');
const CaseHistory = require('../models/CaseHistory.model');
const CaseAudit = require('../models/CaseAudit.model');
const Client = require('../models/Client.model');
const User = require('../models/User.model');
const { detectDuplicates, generateDuplicateOverrideComment } = require('../services/clientDuplicateDetector');
const { CASE_CATEGORIES, CASE_LOCK_CONFIG, CASE_STATUS, COMMENT_PREVIEW_LENGTH, CLIENT_STATUS } = require('../config/constants');
const { isProduction } = require('../config/config');
const { logCaseListViewed, logAdminAction } = require('../services/auditLog.service');
const caseActionService = require('../services/caseAction.service');
const { getMimeType, sanitizeFilename } = require('../utils/fileUtils');
const fs = require('fs').promises;
const path = require('path');

/**
 * Case Controller for Core Case APIs
 * Handles case creation, comments, attachments, cloning, unpending, and status updates
 * PART F - Duplicate client detection for "Client – New" cases
 * PR #44 - xID ownership guardrails
 * PR #45 - View-only mode with audit logging
 */

/**
 * Build case query with firmId scoping
 * 
 * Ensures all case queries are scoped to the user's firm for multi-tenancy.
 * SUPER_ADMIN (no firmId) can see all cases across all firms.
 * 
 * @param {Object} req - Express request object with authenticated user
 * @param {string} caseId - Optional caseId to include in query
 * @returns {Object} Query object with firmId scoping
 */
const buildCaseQuery = (req, caseId = null) => {
  const userFirmId = req.user?.firmId;
  const query = {};
  
  // Add firmId scoping if user has a firmId (not SUPER_ADMIN)
  if (userFirmId) {
    query.firmId = userFirmId;
  }
  
  // Add caseId if provided
  if (caseId) {
    query.caseId = caseId;
  }
  
  return query;
};

/**
 * Sanitize text for logging
 * Removes control characters, newlines, and limits length
 * PR #45: Security - prevent log injection
 */
const sanitizeForLog = (text, maxLength = 100) => {
  if (!text) return '';
  return text
    .replace(/[\r\n\t]/g, ' ')  // Replace newlines and tabs with spaces
    .replace(/[^\x20-\x7E]/g, '') // Remove non-printable characters
    .substring(0, maxLength)
    .trim();
};

/**
 * Create a new case
 * POST /api/cases
 * PART F - Duplicate detection for "Client – New" category
 * 
 * Requirements:
 * - title is now OPTIONAL
 * - caseCategory is MANDATORY
 * - caseSubCategory is optional
 * - clientId defaults to C000001 if not provided
 * - Case ID auto-generated as CASE-YYYYMMDD-XXXXX
 * - Client case data stored in payload field
 */
const createCase = async (req, res) => {
  try {
    const {
      title,
      description,
      categoryId,
      subcategoryId,
      category, // Legacy field for backward compatibility
      caseCategory,
      caseSubCategory,
      clientId,
      priority,
      assignedTo,
      slaDueDate, // SLA due date for case completion - MANDATORY
      forceCreate, // Flag to override duplicate warning
      clientData, // Client data for duplicate detection (for "Client – New" cases)
      payload, // Payload for client governance cases
    } = req.body;
    
    // Validate required fields
    if (!title || !title.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Case title is required',
      });
    }
    
    if (!description || !description.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Case description is required',
      });
    }
    
    if (!categoryId) {
      return res.status(400).json({
        success: false,
        message: 'Category is required',
      });
    }
    
    if (!subcategoryId) {
      return res.status(400).json({
        success: false,
        message: 'Subcategory is required',
      });
    }
    
    if (!slaDueDate) {
      return res.status(400).json({
        success: false,
        message: 'SLA Due Date is required',
      });
    }
    
    // Get creator xID from authenticated user (req.user is set by auth middleware)
    const createdByXID = req.user.xID;
    
    if (!createdByXID) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required - user identity not found',
      });
    }
    
    // Verify category exists and is active
    const Category = require('../models/Category.model');
    const categoryDoc = await Category.findById(categoryId);
    
    if (!categoryDoc || !categoryDoc.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Category not found or inactive',
      });
    }
    
    // Verify subcategory exists and is active within the category
    const subcategory = categoryDoc.subcategories.find(
      sub => sub.id === subcategoryId && sub.isActive
    );
    
    if (!subcategory) {
      return res.status(404).json({
        success: false,
        message: 'Subcategory not found or inactive',
      });
    }
    
    // Default clientId to C000001 if not provided
    const finalClientId = clientId || 'C000001';
    
    // Verify client exists and validate status
    // PR: Client Lifecycle Enforcement - only ACTIVE clients can be used for new cases
    const client = await Client.findOne({ clientId: finalClientId });
    
    if (!client) {
      return res.status(404).json({
        success: false,
        message: `Client ${finalClientId} not found`,
      });
    }
    
    // Check client status
    if (client.status !== CLIENT_STATUS.ACTIVE) {
      return res.status(400).json({
        success: false,
        message: 'This client is no longer active. Please contact your administrator to proceed.',
      });
    }
    
    // Determine the actual category name to use (for backward compatibility)
    const actualCategory = caseCategory || category || categoryDoc.name;
    
    // PART F: Duplicate detection for "Client – New" category
    let duplicateMatches = null;
    let systemComment = null;
    
    if (actualCategory === CASE_CATEGORIES.CLIENT_NEW) {
      // Detect duplicates using client data
      const dataToCheck = clientData || (payload && payload.clientData) || {
        businessName: client.businessName,
        businessAddress: client.businessAddress,
        primaryContactNumber: client.primaryContactNumber,
        businessEmail: client.businessEmail,
        PAN: client.PAN,
        GST: client.GST,
        CIN: client.CIN,
      };
      
      const duplicateResult = await detectDuplicates(dataToCheck);
      
      if (duplicateResult.hasDuplicates) {
        // Filter out the current client from matches (if checking against existing client)
        duplicateMatches = duplicateResult.matches.filter(
          match => match.clientId !== finalClientId
        );
        
        if (duplicateMatches.length > 0) {
          // If forceCreate is not set, return 409 with match details
          if (!forceCreate) {
            return res.status(409).json({
              success: false,
              message: 'Possible duplicate client detected',
              duplicates: {
                matchCount: duplicateMatches.length,
                matches: duplicateMatches,
              },
              hint: 'Set forceCreate=true to proceed anyway',
            });
          }
          
          // If forceCreate is set, generate system comment
          systemComment = generateDuplicateOverrideComment(duplicateMatches);
        }
      }
    }
    
    // Get firmId from authenticated user (PR 1: Multi-tenancy from auth context)
    const firmId = req.user.firmId || 'FIRM001'; // Default to FIRM001 for single-tenant deployments
    
    // Create new case with defaults
    const newCase = new Case({
      title: title.trim(),
      description: description.trim(),
      categoryId,
      subcategoryId,
      category: actualCategory, // Legacy field
      caseCategory: actualCategory,
      caseSubCategory: subcategory.name,
      clientId: finalClientId,
      firmId, // PR 2: Explicitly set firmId for atomic counter scoping
      createdByXID, // Set from authenticated user context
      createdBy: req.user.email || req.user.xID, // Legacy field - use email or xID as fallback
      priority: priority || 'Medium',
      status: 'UNASSIGNED', // New cases default to UNASSIGNED for global worklist
      assignedToXID: assignedTo ? assignedTo.toUpperCase() : null, // PR: xID Canonicalization - Store in assignedToXID
      slaDueDate: new Date(slaDueDate), // Store SLA due date - MANDATORY
      payload, // Store client case payload if provided
    });
    
    await newCase.save();
    
    // Create case history entry with enhanced audit logging
    const { logCaseHistory } = require('../services/auditLog.service');
    const { CASE_ACTION_TYPES } = require('../config/constants');
    
    await logCaseHistory({
      caseId: newCase.caseId,
      firmId: newCase.firmId,
      actionType: CASE_ACTION_TYPES.CASE_CREATED,
      actionLabel: `Case created by ${req.user.name || req.user.xID}`,
      description: `Case created with status: UNASSIGNED, Client: ${finalClientId}, Category: ${actualCategory}`,
      performedBy: req.user.email,
      performedByXID: createdByXID,
      actorRole: req.user.role === 'Admin' ? 'ADMIN' : 'USER',
      metadata: {
        category: actualCategory,
        clientId: finalClientId,
        priority: priority || 'Medium',
        slaDueDate: newCase.slaDueDate,
        assignedToXID: newCase.assignedToXID,
        duplicateOverridden: !!systemComment,
      },
      req,
    });
    
    // Add system comment if duplicate was overridden
    if (systemComment) {
      await Comment.create({
        caseId: newCase.caseId,
        text: systemComment,
        createdBy: 'system',
        note: 'Automated duplicate detection notice',
      });
    }
    
    res.status(201).json({
      success: true,
      data: newCase,
      message: 'Case created successfully',
      duplicateWarning: systemComment ? {
        message: 'Case created with duplicate warning',
        matchCount: duplicateMatches.length,
      } : null,
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
 * PR #41: Allow comments in view mode (no assignment check)
 * PR #45: Add CaseAudit logging with xID attribution
 */
const addComment = async (req, res) => {
  try {
    const { caseId } = req.params;
    const { text, createdBy, note } = req.body;
    
    // PR #45: Require authenticated user with xID for security and audit
    if (!req.user?.email || !req.user?.xID) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }
    
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
    
    // Check if case exists - with firmId scoping
    const query = buildCaseQuery(req, caseId);
    const caseData = await Case.findOne(query);
    
    if (!caseData) {
      return res.status(404).json({
        success: false,
        message: 'Case not found',
      });
    }
    
    // PR #45: Allow comments in view mode - no assignment/ownership check
    // Only check if case is locked by someone else - use authenticated user for security
    if (caseData.lockStatus?.isLocked && 
        caseData.lockStatus.activeUserEmail !== req.user.email.toLowerCase()) {
      return res.status(423).json({
        success: false,
        message: `Case is currently locked by ${caseData.lockStatus.activeUserEmail}`,
      });
    }
    
    // Create comment
    const comment = await Comment.create({
      caseId,
      text,
      createdBy: createdBy.toLowerCase(),
      createdByXID: req.user.xID,
      createdByName: req.user.name,
      note,
    });
    
    // PR #45: Add CaseAudit entry with xID attribution
    // Sanitize comment text for logging to prevent log injection
    const sanitizedText = sanitizeForLog(text, COMMENT_PREVIEW_LENGTH);
    await CaseAudit.create({
      caseId,
      actionType: 'CASE_COMMENT_ADDED',
      description: `Comment added by ${req.user.xID}: ${sanitizedText}${text.length > COMMENT_PREVIEW_LENGTH ? '...' : ''}`,
      performedByXID: req.user.xID,
      metadata: {
        commentLength: text.length,
        hasNote: !!note,
      },
    });
    
    // Also add to CaseHistory for backward compatibility
    await CaseHistory.create({
      caseId,
      actionType: 'CASE_COMMENT_ADDED',
      description: `Comment added by ${req.user.email}: ${text.substring(0, COMMENT_PREVIEW_LENGTH)}${text.length > COMMENT_PREVIEW_LENGTH ? '...' : ''}`,
      performedBy: req.user.email.toLowerCase(),
      performedByXID: req.user.xID.toUpperCase(), // Canonical identifier (uppercase)
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
 * PR #41: Allow attachments in view mode (no assignment check)
 * PR #45: Add CaseAudit logging with xID attribution
 */
const addAttachment = async (req, res) => {
  try {
    const { caseId } = req.params;
    const { description, createdBy, note } = req.body;
    
    // PR #45: Require authenticated user with xID for security and audit
    if (!req.user?.email || !req.user?.xID) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }
    
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
    
    // PR #45: Allow attachments in view mode - no assignment/ownership check
    // Only check if case is locked by someone else - use authenticated user for security
    if (caseData.lockStatus?.isLocked && 
        caseData.lockStatus.activeUserEmail !== req.user.email.toLowerCase()) {
      return res.status(423).json({
        success: false,
        message: `Case is currently locked by ${caseData.lockStatus.activeUserEmail}`,
      });
    }
    
    // Create attachment record
    const attachment = await Attachment.create({
      caseId,
      fileName: req.file.originalname,
      filePath: req.file.path,
      description,
      createdBy: createdBy.toLowerCase(),
      createdByXID: req.user.xID,
      createdByName: req.user.name,
      note,
    });
    
    // PR #45: Add CaseAudit entry with xID attribution
    // Sanitize filename for logging to prevent log injection
    const sanitizedFilename = sanitizeForLog(req.file.originalname, 100);
    await CaseAudit.create({
      caseId,
      actionType: 'CASE_FILE_ATTACHED',
      description: `File attached by ${req.user.xID}: ${sanitizedFilename}`,
      performedByXID: req.user.xID,
      metadata: {
        fileName: req.file.originalname,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        description: description,
      },
    });
    
    // Also add to CaseHistory for backward compatibility
    await CaseHistory.create({
      caseId,
      actionType: 'CASE_ATTACHMENT_ADDED',
      description: `Attachment uploaded by ${req.user.email}: ${sanitizedFilename}`,
      performedBy: req.user.email.toLowerCase(),
      performedByXID: req.user.xID.toUpperCase(), // Canonical identifier (uppercase)
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
    
    // PR: Client Lifecycle Enforcement - validate client is ACTIVE before cloning
    const client = await Client.findOne({ clientId: originalCase.clientId });
    
    if (!client) {
      return res.status(404).json({
        success: false,
        message: `Client ${originalCase.clientId} not found`,
      });
    }
    
    // Check client status
    if (client.status !== CLIENT_STATUS.ACTIVE) {
      return res.status(400).json({
        success: false,
        message: 'This client is no longer active. Please contact your administrator to proceed.',
      });
    }
    
    // Create new case
    const newCase = new Case({
      title: originalCase.title,
      description: originalCase.description,
      category: newCategory,
      clientId: originalCase.clientId,
      priority: originalCase.priority,
      status: 'Open',
      pendingUntil: null,
      createdBy: clonedBy.toLowerCase(),
      assignedToXID: assignedTo ? assignedTo.toUpperCase() : null, // PR: xID Canonicalization - Store in assignedToXID
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
        const newFilePath = path.join(__dirname, '../../uploads', newFileName);
        
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
/**
 * Unpend a case (manual unpend)
 * POST /api/cases/:caseId/unpend
 * 
 * Changes case status from PENDED/PENDING back to OPEN with mandatory comment.
 * Allows users to manually unpend a case before the auto-reopen date.
 * 
 * PR: Fix Case Lifecycle - Updated to use centralized service
 */
const unpendCase = async (req, res) => {
  try {
    const { caseId } = req.params;
    const { comment } = req.body;
    
    // Validate user authentication
    if (!req.user || !req.user.xID) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }
    
    // Call service to unpend case
    const caseData = await caseActionService.unpendCase(caseId, comment, req.user);
    
    res.json({
      success: true,
      data: caseData,
      message: 'Case unpended successfully',
    });
  } catch (error) {
    // Handle specific errors
    if (error.message === 'Comment is mandatory for this action') {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
    
    if (error.message === 'Case not found') {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }
    
    if (error.message.startsWith('Cannot change case from')) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
    
    res.status(500).json({
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
 * PR #41: Add CASE_VIEWED audit log
 * PR #44: Runtime assertion for xID context
 * PR #45: Enhanced audit logging with CaseAudit and view mode detection
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
    
    // PR #45: Also fetch CaseAudit entries for view-mode tracking
    // Use aggregation to lookup user names from performedByXID
    const auditLog = await CaseAudit.aggregate([
      { $match: { caseId } },
      { $sort: { timestamp: -1 } },
      { $limit: 50 },
      {
        $lookup: {
          from: 'users',
          localField: 'performedByXID',
          foreignField: 'xID',
          as: 'userInfo'
        }
      },
      {
        $addFields: {
          performedByName: { $arrayElemAt: ['$userInfo.name', 0] }
        }
      },
      {
        $project: {
          userInfo: 0  // Remove the userInfo array from results
        }
      }
    ]);
    
    // Fetch current client details
    // TODO: Consider using aggregation pipeline with $lookup for better performance
    // PR: Client Lifecycle - fetch client regardless of status to display existing cases with inactive clients
    const client = await Client.findOne({ clientId: caseData.clientId });
    
    // PR #45: Require authenticated user with xID for audit logging
    if (!req.user?.email || !req.user?.xID) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }
    
    // PR #44: Runtime assertion - warn if xID is missing from auth context
    if (!req.user.xID && !isProduction()) {
      console.warn(`[xID Guardrail] Case accessed without xID in auth context`);
      console.warn(`[xID Guardrail] Case: ${caseId}, User email: ${req.user.email}`);
      console.warn(`[xID Guardrail] This should not happen - auth middleware should always provide xID`);
    }
    
    // PR #45: Determine if user is viewing in view-only mode
    // View-only mode: case is not assigned to the current user
    const isViewOnlyMode = caseData.assignedToXID !== req.user.xID;
    const isOwner = caseData.createdByXID === req.user.xID;
    
    // PR #45: Add CaseAudit entry with xID attribution
    await CaseAudit.create({
      caseId,
      actionType: 'CASE_VIEWED',
      description: `Case viewed by ${req.user.xID}${isViewOnlyMode ? ' (view-only mode)' : ' (assigned mode)'}`,
      performedByXID: req.user.xID,
      metadata: {
        isViewOnlyMode,
        isOwner,
        isAssigned: !isViewOnlyMode,
      },
    });
    
    // Also add to CaseHistory for backward compatibility
    await CaseHistory.create({
      caseId,
      actionType: 'CASE_VIEWED',
      description: `Case viewed by ${req.user.email}`,
      performedBy: req.user.email.toLowerCase(),
      performedByXID: req.user.xID.toUpperCase(), // Canonical identifier (uppercase)
    });
    
    res.json({
      success: true,
      data: {
        case: caseData,
        client: client ? {
          clientId: client.clientId,
          businessName: client.businessName,
          primaryContactNumber: client.primaryContactNumber,
          businessEmail: client.businessEmail,
          status: client.status, // Include status for inactive label display
          isActive: client.isActive, // Legacy field for backward compatibility
        } : null,
        comments,
        attachments,
        history,
        auditLog, // PR #45: Include audit log for UI
        // PR #45: Include access mode information for UI
        accessMode: {
          isViewOnlyMode,
          isOwner,
          isAssigned: !isViewOnlyMode,
          canEdit: !isViewOnlyMode,
          canComment: true, // Always allowed
          canAttach: true, // Always allowed
        },
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
 * PR #42: Handle assignedTo as xID (or email for backward compatibility)
 * PR #44: Added runtime assertions for xID ownership guardrails
 */
const getCases = async (req, res) => {
  try {
    const {
      status,
      category,
      priority,
      assignedTo,
      createdBy,
      clientId,
      page = 1,
      limit = 20,
    } = req.query;
    
    // Get firmId from authenticated user for query scoping
    const userFirmId = req.user?.firmId;
    
    // Base query with firmId scoping (SUPER_ADMIN has no firmId, can see all)
    const query = userFirmId ? { firmId: userFirmId } : {};
    
    if (status) query.status = status;
    if (category) query.category = category;
    if (priority) query.priority = priority;
    
    // PR: xID Canonicalization - Use assignedToXID field
    // Reject email-based queries completely
    if (assignedTo) {
      const trimmedAssignedTo = assignedTo.trim();
      if (/^X\d{6}$/i.test(trimmedAssignedTo)) {
        query.assignedToXID = trimmedAssignedTo.toUpperCase();
      } else {
        // Reject email-based queries
        return res.status(400).json({
          success: false,
          message: 'Email-based assignedTo queries are not supported. Please use xID (format: X123456)',
        });
      }
    }
    
    // PR #44: Log warning if createdBy query is used (deprecated)
    if (createdBy) {
      if (!isProduction()) {
        console.warn(`[xID Guardrail] Email-based creator query detected: createdBy="${createdBy}"`);
        console.warn(`[xID Guardrail] This is deprecated. Please use createdByXID for ownership queries.`);
      }
      query.createdBy = createdBy.toLowerCase();
    }
    
    if (clientId) query.clientId = clientId;
    
    // Apply client access filter from middleware (restrictedClientIds)
    if (req.clientAccessFilter) {
      Object.assign(query, req.clientAccessFilter);
    }
    
    const cases = await Case.find(query)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .sort({ createdAt: -1 });
    
    // Fetch client details for each case
    // TODO: Optimize N+1 query - consider pre-fetching unique clientIds or using aggregation
    // TODO: Use MongoDB aggregation with $lookup to join client data in a single query
    // Example: Case.aggregate([{ $lookup: { from: 'clients', localField: 'clientId', foreignField: 'clientId', as: 'client' }}])
    // PR: Client Lifecycle - fetch clients regardless of status to display existing cases with inactive clients
    const casesWithClients = await Promise.all(
      cases.map(async (caseItem) => {
        const client = await Client.findOne({ clientId: caseItem.clientId });
        return {
          ...caseItem.toObject(),
          client: client ? {
            clientId: client.clientId,
            businessName: client.businessName,
            primaryContactNumber: client.primaryContactNumber,
            businessEmail: client.businessEmail,
            status: client.status, // Include status for inactive label display
            isActive: client.isActive, // Legacy field for backward compatibility
          } : null,
        };
      })
    );
    
    const total = await Case.countDocuments(query);
    
    // Log case list view for audit
    if (req.user?.xID) {
      // Determine if this is an admin viewing pending approvals
      const isPendingApprovalView = 
        status === CASE_STATUS.PENDING || 
        status === CASE_STATUS.REVIEWED || 
        status === CASE_STATUS.UNDER_REVIEW;
      
      if (isPendingApprovalView && req.user.role === 'Admin') {
        // Log admin approval queue access
        await logAdminAction({
          adminXID: req.user.xID,
          actionType: 'ADMIN_APPROVAL_QUEUE_VIEWED',
          metadata: {
            filters: { status, category, priority, assignedTo, clientId },
            resultCount: casesWithClients.length,
            total,
          },
        });
      } else {
        // Log regular case list view
        await logCaseListViewed({
          viewerXID: req.user.xID,
          filters: { status, category, priority, assignedTo, clientId },
          listType: 'FILTERED_CASES',
          resultCount: casesWithClients.length,
        });
      }
    }
    
    res.json({
      success: true,
      data: casesWithClients,
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
 * 
 * Implements soft locking with 2-hour inactivity auto-unlock
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
    
    // Build query with firmId scoping
    const query = buildCaseQuery(req, caseId);
    const caseData = await Case.findOne(query);
    
    if (!caseData) {
      return res.status(404).json({
        success: false,
        message: 'Case not found',
      });
    }
    
    // Check if already locked by another user
    if (caseData.lockStatus.isLocked && 
        caseData.lockStatus.activeUserEmail !== userEmail.toLowerCase()) {
      
      // Check for inactivity auto-unlock
      const inactivityTimeout = CASE_LOCK_CONFIG.INACTIVITY_TIMEOUT_MS;
      const lastActivity = caseData.lockStatus.lastActivityAt || caseData.lockStatus.lockedAt;
      const now = new Date();
      
      if (lastActivity && (now - lastActivity) > inactivityTimeout) {
        // Auto-unlock due to inactivity
        console.log(`Auto-unlocking case ${caseId} due to ${CASE_LOCK_CONFIG.INACTIVITY_TIMEOUT_HOURS}-hour inactivity`);
        
        // Log the auto-unlock in history
        await CaseHistory.create({
          caseId,
          actionType: 'AutoUnlocked',
          description: `Case auto-unlocked due to 2 hours of inactivity. Previous lock holder: ${caseData.lockStatus.activeUserEmail}`,
          performedBy: 'system',
        });
        
        // Fall through to acquire new lock below
      } else {
        // Still within 2-hour window, deny lock
        return res.status(409).json({
          success: false,
          message: `Case is currently locked by ${caseData.lockStatus.activeUserEmail}`,
          lockedBy: caseData.lockStatus.activeUserEmail,
          lockedAt: caseData.lockStatus.lockedAt,
          lastActivityAt: lastActivity,
        });
      }
    }
    
    // Lock the case
    const now = new Date();
    caseData.lockStatus = {
      isLocked: true,
      activeUserEmail: userEmail.toLowerCase(),
      lockedAt: now,
      lastActivityAt: now,
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
      lastActivityAt: null,
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

/**
 * Update case activity (heartbeat)
 * POST /api/cases/:caseId/activity
 * 
 * Updates lastActivityAt to prevent auto-unlock
 */
const updateCaseActivity = async (req, res) => {
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
    
    // Only update activity if locked by this user
    if (caseData.lockStatus.isLocked && 
        caseData.lockStatus.activeUserEmail === userEmail.toLowerCase()) {
      caseData.lockStatus.lastActivityAt = new Date();
      await caseData.save();
      
      res.json({
        success: true,
        message: 'Case activity updated',
        lastActivityAt: caseData.lockStatus.lastActivityAt,
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Case is not locked by you',
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating case activity',
      error: error.message,
    });
  }
};

/**
 * Unified Pull Endpoint - Pull one or multiple cases from global worklist
 * POST /api/cases/pull
 * 
 * Atomically assigns cases to the authenticated user using the assignment service.
 * User identity is obtained from authentication token (req.user), not from request body.
 * 
 * Replaces the legacy endpoints:
 * - POST /api/cases/:caseId/pull (removed)
 * - POST /api/cases/bulk-pull (removed)
 * 
 * Required payload:
 * {
 *   "caseIds": ["CASE-20260109-00001"] // single case
 * }
 * OR
 * {
 *   "caseIds": ["CASE-20260109-00001", "CASE-20260109-00002"] // multiple cases
 * }
 * 
 * 🚫 REJECTED payloads:
 * - Contains userEmail
 * - Contains userXID (must come from req.user only)
 * 
 * Authentication: User identity is obtained from req.user (set by auth middleware)
 * Authorization: Cases are assigned to the authenticated user's xID
 * 
 * PR: Hard Cutover to xID - Unified single and bulk pull into one endpoint
 */
const pullCases = async (req, res) => {
  try {
    const { caseIds } = req.body;
    
    // Get authenticated user from req.user (set by auth middleware)
    const user = req.user;
    
    if (!user || !user.xID) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required - user identity not found',
      });
    }
    
    // Reject if userEmail or userXID is in the payload
    if (req.body.userEmail || req.body.userXID) {
      return res.status(400).json({
        success: false,
        message: 'userEmail and userXID must not be provided in request body. User identity is obtained from authentication token.',
      });
    }
    
    if (!Array.isArray(caseIds) || caseIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Case IDs array is required and must not be empty',
      });
    }
    
    // Validate caseIds format (expect CASE-YYYYMMDD-XXXXX format)
    const invalidCaseIds = caseIds.filter(id => !/^CASE-\d{8}-\d{5}$/i.test(id));
    if (invalidCaseIds.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Invalid case ID format. Expected format: CASE-YYYYMMDD-XXXXX. Invalid IDs: ${invalidCaseIds.join(', ')}`,
      });
    }
    
    // Use assignment service for canonical assignment logic
    const caseAssignmentService = require('../services/caseAssignment.service');
    
    // Handle single case pull vs bulk pull
    if (caseIds.length === 1) {
      // Single case pull
      const result = await caseAssignmentService.assignCaseToUser(caseIds[0], user);
      
      if (!result.success) {
        return res.status(409).json({
          success: false,
          message: result.message,
          currentStatus: result.currentStatus,
          assignedToXID: result.assignedToXID,
        });
      }
      
      return res.json({
        success: true,
        data: result.data,
        message: 'Case pulled successfully',
      });
    } else {
      // Bulk case pull
      const result = await caseAssignmentService.bulkAssignCasesToUser(caseIds, user);
      
      const successCount = result.assigned;
      const requestedCount = result.requested;
      
      if (successCount === 0) {
        return res.status(409).json({
          success: false,
          message: 'No cases were pulled. All cases were already assigned to other users.',
          pulled: 0,
          requested: requestedCount,
        });
      }
      
      if (successCount < requestedCount) {
        return res.status(200).json({
          success: true,
          message: `Partial success: ${successCount} of ${requestedCount} cases pulled. Some cases were already assigned to other users.`,
          pulled: successCount,
          requested: requestedCount,
          data: result.cases,
        });
      }
      
      return res.json({
        success: true,
        message: `All ${successCount} cases pulled successfully`,
        pulled: successCount,
        requested: requestedCount,
        data: result.cases,
      });
    }
  } catch (error) {
    // Handle specific errors
    if (error.message === 'Case not found') {
      return res.status(404).json({
        success: false,
        message: 'Case not found',
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error pulling cases',
      error: error.message,
    });
  }
};

/**
 * Move case to global worklist (unassign)
 * POST /api/cases/:caseId/unassign
 * Admin only - moves case back to global worklist
 * 
 * This endpoint:
 * - Sets assignedToXID = null
 * - Sets queueType = GLOBAL
 * - Sets status = UNASSIGNED
 * - Creates audit log entry
 */
const unassignCase = async (req, res) => {
  try {
    const { caseId } = req.params;
    
    // Get authenticated user from req.user (set by auth middleware)
    const user = req.user;
    
    if (!user || !user.xID) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required - user identity not found',
      });
    }
    
    // Check if user is admin
    if (user.role !== 'Admin') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden - Only admins can move cases to global worklist',
      });
    }
    
    // Find the case
    const caseData = await Case.findOne({ caseId });
    
    if (!caseData) {
      return res.status(404).json({
        success: false,
        message: 'Case not found',
      });
    }
    
    // Store previous assignment for audit log
    const previousAssignedToXID = caseData.assignedToXID;
    const previousStatus = caseData.status;
    
    // Prepare audit log entry (validate before mutating case)
    const auditEntry = {
      caseId,
      actionType: CASE_ACTION_TYPES.CASE_MOVED_TO_WORKBASKET,
      description: `Case moved to Global Worklist by admin ${user.xID}${previousAssignedToXID ? ` (was assigned to ${previousAssignedToXID})` : ''}`,
      performedByXID: user.xID,
      metadata: {
        previousAssignedToXID,
        previousStatus,
        actionReason: 'Admin moved case to global worklist',
      },
    };
    
    // Validate audit entry can be created (this will throw if validation fails)
    const auditDoc = new CaseAudit(auditEntry);
    await auditDoc.validate();
    
    // Update case to move to global worklist
    caseData.assignedToXID = null;
    caseData.assignedTo = null; // Also clear legacy field
    caseData.queueType = 'GLOBAL';
    caseData.status = 'UNASSIGNED';
    caseData.assignedAt = null;
    
    await caseData.save();
    
    // Now create the audit log entry (validation already passed)
    await auditDoc.save();
    
    // Also add to CaseHistory with enhanced logging
    const { logCaseHistory } = require('../services/auditLog.service');
    const { CASE_ACTION_TYPES } = require('../config/constants');
    
    await logCaseHistory({
      caseId,
      firmId: caseData.firmId,
      actionType: CASE_ACTION_TYPES.CASE_MOVED_TO_WORKBASKET,
      actionLabel: `Case moved to workbasket by ${user.name || user.xID}`,
      description: `Case moved to Global Worklist by admin ${user.xID}${previousAssignedToXID ? ` (was assigned to ${previousAssignedToXID})` : ''}`,
      performedBy: user.email,
      performedByXID: user.xID,
      actorRole: 'ADMIN',
      metadata: {
        previousAssignedToXID,
        previousStatus,
        actionReason: 'Admin moved case to global worklist',
      },
      req,
    });
    
    res.json({
      success: true,
      data: caseData,
      message: 'Case moved to Global Worklist successfully',
    });
  } catch (error) {
    console.error('[unassignCase] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error moving case to global worklist',
    });
  }
};


/**
 * View attachment (inline in browser)
 * GET /api/cases/:caseId/attachments/:attachmentId/view
 * 
 * Security:
 * - Validates authenticated user
 * - Validates case exists and user has access to it
 */
const viewAttachment = async (req, res) => {
  try {
    const { caseId, attachmentId } = req.params;
    
    // Validate authentication
    if (!req.user?.email || !req.user?.xID) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }
    
    // Verify case exists and user has access
    const caseData = await Case.findOne({ caseId });
    
    if (!caseData) {
      return res.status(404).json({
        success: false,
        message: 'Case not found',
      });
    }
    
    // Find attachment
    const attachment = await Attachment.findById(attachmentId);
    
    if (!attachment) {
      return res.status(404).json({
        success: false,
        message: 'Attachment not found',
      });
    }
    
    // Verify attachment belongs to this case
    if (attachment.caseId !== caseId) {
      return res.status(403).json({
        success: false,
        message: 'Attachment does not belong to this case',
      });
    }
    
    // Check if file exists
    try {
      await fs.access(attachment.filePath);
    } catch (err) {
      return res.status(404).json({
        success: false,
        message: 'File not found on server',
      });
    }
    
    // Determine MIME type and sanitize filename
    const mimeType = getMimeType(attachment.fileName);
    const safeFilename = sanitizeFilename(attachment.fileName);
    
    // Set headers for inline viewing
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${safeFilename}"`);
    
    // Send file
    res.sendFile(path.resolve(attachment.filePath));
  } catch (error) {
    console.error('[viewAttachment] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error viewing attachment',
      error: error.message,
    });
  }
};

/**
 * Download attachment (force download)
 * GET /api/cases/:caseId/attachments/:attachmentId/download
 * 
 * Security:
 * - Validates authenticated user
 * - Validates case exists and user has access to it
 */
const downloadAttachment = async (req, res) => {
  try {
    const { caseId, attachmentId } = req.params;
    
    // Validate authentication
    if (!req.user?.email || !req.user?.xID) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }
    
    // Verify case exists and user has access
    const caseData = await Case.findOne({ caseId });
    
    if (!caseData) {
      return res.status(404).json({
        success: false,
        message: 'Case not found',
      });
    }
    
    // Find attachment
    const attachment = await Attachment.findById(attachmentId);
    
    if (!attachment) {
      return res.status(404).json({
        success: false,
        message: 'Attachment not found',
      });
    }
    
    // Verify attachment belongs to this case
    if (attachment.caseId !== caseId) {
      return res.status(403).json({
        success: false,
        message: 'Attachment does not belong to this case',
      });
    }
    
    // Check if file exists
    try {
      await fs.access(attachment.filePath);
    } catch (err) {
      return res.status(404).json({
        success: false,
        message: 'File not found on server',
      });
    }
    
    // Determine MIME type and sanitize filename
    const mimeType = getMimeType(attachment.fileName);
    const safeFilename = sanitizeFilename(attachment.fileName);
    
    // Set headers for download
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
    
    // Send file
    res.sendFile(path.resolve(attachment.filePath));
  } catch (error) {
    console.error('[downloadAttachment] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error downloading attachment',
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
  updateCaseActivity,
  pullCases,
  unassignCase,
  viewAttachment,
  downloadAttachment,
};
