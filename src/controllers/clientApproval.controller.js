const Case = require('../models/Case.model');
const Comment = require('../models/Comment.model');
const Client = require('../models/Client.model');
const CaseHistory = require('../models/CaseHistory.model');
const { CASE_CATEGORIES, CASE_STATUS } = require('../config/constants');

/**
 * Client Approval Controller
 * 
 * Handles case-driven client creation and editing workflows.
 * All client mutations go through Admin-approved cases.
 * 
 * Key Principles:
 * - NO direct client edit APIs
 * - All changes via "Client - New" or "Client - Edit" cases
 * - Admin approval required for DB mutation
 * - Full audit trail in CaseHistory
 * - Immutable clientId enforcement
 */

/**
 * Approve Client Creation (Client - New case)
 * POST /api/client-approval/:caseId/approve-new
 * 
 * Admin-only endpoint to approve a "Client - New" case
 * Creates the new client in the database and updates case status
 * Uses new workflow states and payload structure
 */
const approveNewClient = async (req, res) => {
  try {
    const { caseId } = req.params;
    const { approverEmail, comment } = req.body;
    
    // Validate required fields
    if (!approverEmail) {
      return res.status(400).json({
        success: false,
        message: 'Approver email is required',
      });
    }
    
    if (!comment) {
      return res.status(400).json({
        success: false,
        message: 'Comment is mandatory for approval',
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
    
    // Verify case category
    const category = caseData.caseCategory || caseData.category;
    if (category !== CASE_CATEGORIES.CLIENT_NEW) {
      return res.status(400).json({
        success: false,
        message: 'This endpoint is only for "Client - New" cases',
      });
    }
    
    // Verify case is in SUBMITTED or UNDER_REVIEW status
    const validStatuses = [CASE_STATUS.SUBMITTED, CASE_STATUS.UNDER_REVIEW, CASE_STATUS.REVIEWED];
    if (!validStatuses.includes(caseData.status)) {
      return res.status(400).json({
        success: false,
        message: `Case must be in SUBMITTED or UNDER_REVIEW status to approve. Current status: ${caseData.status}`,
      });
    }
    
    // Extract client data from payload or legacy description
    let clientData;
    if (caseData.payload && caseData.payload.clientData) {
      clientData = caseData.payload.clientData;
    } else {
      // Fallback to legacy description format
      try {
        clientData = JSON.parse(caseData.description);
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: 'Invalid client data format. Expected payload.clientData or JSON in description.',
        });
      }
    }
    
    // Validate required client fields
    const requiredFields = ['businessName', 'businessAddress', 'businessPhone', 'businessEmail'];
    const missingFields = requiredFields.filter(field => !clientData[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required client fields: ${missingFields.join(', ')}`,
      });
    }
    
    // Create the new client
    const newClient = new Client({
      businessName: clientData.businessName,
      businessAddress: clientData.businessAddress,
      businessPhone: clientData.businessPhone,
      businessEmail: clientData.businessEmail,
      PAN: clientData.PAN !== undefined ? clientData.PAN : null,
      GST: clientData.GST !== undefined ? clientData.GST : null,
      CIN: clientData.CIN !== undefined ? clientData.CIN : null,
      latitude: clientData.latitude !== undefined ? clientData.latitude : null,
      longitude: clientData.longitude !== undefined ? clientData.longitude : null,
      isSystemClient: false,
      isActive: true,
      createdBy: approverEmail.toLowerCase(),
    });
    
    await newClient.save();
    
    // Update case with approval metadata
    caseData.status = CASE_STATUS.APPROVED;
    caseData.approvedAt = new Date();
    caseData.approvedBy = approverEmail.toLowerCase();
    caseData.decisionComments = comment;
    await caseData.save();
    
    // Add approval comment
    await Comment.create({
      caseId,
      text: comment,
      createdBy: approverEmail.toLowerCase(),
      note: 'Admin approval - Client created',
    });
    
    // Create case history entry
    await CaseHistory.create({
      caseId,
      actionType: 'ClientCreated',
      description: `Client created via case ${caseId}. New Client ID: ${newClient.clientId}`,
      performedBy: approverEmail.toLowerCase(),
    });
    
    // Also log case approval
    await CaseHistory.create({
      caseId,
      actionType: 'Approved',
      description: `Case approved by Admin. Client ${newClient.clientId} created successfully.`,
      performedBy: approverEmail.toLowerCase(),
    });
    
    res.status(200).json({
      success: true,
      message: 'Client created successfully',
      data: {
        client: newClient,
        case: caseData,
      },
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Error approving client creation',
      error: error.message,
    });
  }
};

/**
 * Approve Client Edit (Client - Edit case)
 * POST /api/client-approval/:caseId/approve-edit
 * 
 * Admin-only endpoint to approve a "Client - Edit" case
 * Updates the existing client in the database and logs changes in audit trail
 * Uses new workflow states and payload structure
 */
const approveClientEdit = async (req, res) => {
  try {
    const { caseId } = req.params;
    const { approverEmail, comment } = req.body;
    
    // Validate required fields
    if (!approverEmail) {
      return res.status(400).json({
        success: false,
        message: 'Approver email is required',
      });
    }
    
    if (!comment) {
      return res.status(400).json({
        success: false,
        message: 'Comment is mandatory for approval',
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
    
    // Verify case category
    const category = caseData.caseCategory || caseData.category;
    if (category !== CASE_CATEGORIES.CLIENT_EDIT) {
      return res.status(400).json({
        success: false,
        message: 'This endpoint is only for "Client - Edit" cases',
      });
    }
    
    // Verify case is in SUBMITTED or UNDER_REVIEW status
    const validStatuses = [CASE_STATUS.SUBMITTED, CASE_STATUS.UNDER_REVIEW, CASE_STATUS.REVIEWED];
    if (!validStatuses.includes(caseData.status)) {
      return res.status(400).json({
        success: false,
        message: `Case must be in SUBMITTED or UNDER_REVIEW status to approve. Current status: ${caseData.status}`,
      });
    }
    
    // Extract edit data from payload or legacy description
    let editData;
    if (caseData.payload && caseData.payload.clientId && caseData.payload.updates) {
      editData = {
        clientId: caseData.payload.clientId,
        updates: caseData.payload.updates,
      };
    } else {
      // Fallback to legacy description format
      try {
        editData = JSON.parse(caseData.description);
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: 'Invalid edit data format. Expected payload with clientId and updates.',
        });
      }
    }
    
    if (!editData.clientId || !editData.updates) {
      return res.status(400).json({
        success: false,
        message: 'Edit data must include clientId and updates fields',
      });
    }
    
    // Find the client to edit
    const client = await Client.findOne({ clientId: editData.clientId });
    
    if (!client) {
      return res.status(404).json({
        success: false,
        message: `Client ${editData.clientId} not found`,
      });
    }
    
    // Prevent editing system client directly
    if (client.isSystemClient) {
      return res.status(403).json({
        success: false,
        message: 'System organization client cannot be edited',
      });
    }
    
    // Prevent editing clientId (double safety check)
    if (editData.updates.clientId) {
      return res.status(403).json({
        success: false,
        message: 'clientId is immutable and cannot be changed',
      });
    }
    
    // Prevent editing isSystemClient flag
    if (editData.updates.hasOwnProperty('isSystemClient')) {
      return res.status(403).json({
        success: false,
        message: 'isSystemClient flag cannot be changed',
      });
    }
    
    // Store old values for audit trail
    const oldValues = {};
    const changedFields = [];
    
    // Apply updates and track changes
    const allowedFields = [
      'businessName', 'businessAddress', 'businessPhone', 'businessEmail',
      'PAN', 'GST', 'CIN', 'latitude', 'longitude', 'isActive'
    ];
    
    for (const field of allowedFields) {
      if (editData.updates.hasOwnProperty(field)) {
        oldValues[field] = client[field];
        client[field] = editData.updates[field];
        changedFields.push(field);
      }
    }
    
    if (changedFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update',
      });
    }
    
    await client.save();
    
    // Update case with approval metadata
    caseData.status = CASE_STATUS.APPROVED;
    caseData.approvedAt = new Date();
    caseData.approvedBy = approverEmail.toLowerCase();
    caseData.decisionComments = comment;
    await caseData.save();
    
    // Add approval comment
    await Comment.create({
      caseId,
      text: comment,
      createdBy: approverEmail.toLowerCase(),
      note: 'Admin approval - Client updated',
    });
    
    // Create detailed audit trail in case history
    const changesDescription = changedFields.map(field => {
      return `${field}: "${oldValues[field]}" → "${client[field]}"`;
    }).join('; ');
    
    await CaseHistory.create({
      caseId,
      actionType: 'ClientUpdated',
      description: `Client ${client.clientId} updated via case ${caseId}. Changes: ${changesDescription}`,
      performedBy: approverEmail.toLowerCase(),
    });
    
    // Also log case approval
    await CaseHistory.create({
      caseId,
      actionType: 'Approved',
      description: `Case approved by Admin. Client ${client.clientId} updated successfully.`,
      performedBy: approverEmail.toLowerCase(),
    });
    
    res.status(200).json({
      success: true,
      message: 'Client updated successfully',
      data: {
        client,
        case: caseData,
        changes: {
          fields: changedFields,
          oldValues,
          newValues: changedFields.reduce((acc, field) => {
            acc[field] = client[field];
            return acc;
          }, {}),
        },
      },
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Error approving client edit',
      error: error.message,
    });
  }
};

/**
 * Reject Client Case (New or Edit)
 * POST /api/client-approval/:caseId/reject
 * 
 * Admin-only endpoint to reject a client case
 * Updates case status but does NOT mutate client data
 * Uses new workflow states
 */
const rejectClientCase = async (req, res) => {
  try {
    const { caseId } = req.params;
    const { approverEmail, comment } = req.body;
    
    // Validate required fields
    if (!approverEmail) {
      return res.status(400).json({
        success: false,
        message: 'Approver email is required',
      });
    }
    
    if (!comment) {
      return res.status(400).json({
        success: false,
        message: 'Comment is mandatory for rejection',
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
    
    // Verify case category
    const category = caseData.caseCategory || caseData.category;
    const validCategories = [CASE_CATEGORIES.CLIENT_NEW, CASE_CATEGORIES.CLIENT_EDIT, CASE_CATEGORIES.CLIENT_DELETE];
    if (!validCategories.includes(category)) {
      return res.status(400).json({
        success: false,
        message: 'This endpoint is only for client-related cases',
      });
    }
    
    // Verify case is in SUBMITTED or UNDER_REVIEW status
    const validStatuses = [CASE_STATUS.SUBMITTED, CASE_STATUS.UNDER_REVIEW, CASE_STATUS.REVIEWED];
    if (!validStatuses.includes(caseData.status)) {
      return res.status(400).json({
        success: false,
        message: `Case must be in SUBMITTED or UNDER_REVIEW status to reject. Current status: ${caseData.status}`,
      });
    }
    
    // Update case with rejection metadata
    caseData.status = CASE_STATUS.REJECTED;
    caseData.approvedAt = new Date();
    caseData.approvedBy = approverEmail.toLowerCase();
    caseData.decisionComments = comment;
    await caseData.save();
    
    // Add rejection comment
    await Comment.create({
      caseId,
      text: comment,
      createdBy: approverEmail.toLowerCase(),
      note: 'Admin rejection - No changes made',
    });
    
    // Create case history entry
    await CaseHistory.create({
      caseId,
      actionType: 'Rejected',
      description: `Case rejected by Admin. No client changes made. Reason: ${comment}`,
      performedBy: approverEmail.toLowerCase(),
    });
    
    res.status(200).json({
      success: true,
      message: 'Client case rejected - no changes made to client data',
      data: {
        case: caseData,
      },
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Error rejecting client case',
      error: error.message,
    });
  }
};

/**
 * Get Client by ClientId
 * GET /api/client-approval/clients/:clientId
 * 
 * Read-only endpoint to fetch client details
 * No mutations allowed - for display purposes only
 */
const getClientById = async (req, res) => {
  try {
    const { clientId } = req.params;
    
    const client = await Client.findOne({ clientId, isActive: true });
    
    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found',
      });
    }
    
    res.status(200).json({
      success: true,
      data: client,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching client',
      error: error.message,
    });
  }
};

/**
 * List All Clients
 * GET /api/client-approval/clients
 * 
 * Read-only endpoint to list all active clients
 * No mutations allowed - for display purposes only
 */
const listClients = async (req, res) => {
  try {
    const { page = 1, limit = 20, includeInactive = false } = req.query;
    
    const query = includeInactive === 'true' ? {} : { isActive: true };
    
    const clients = await Client.find(query)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .sort({ createdAt: -1 });
    
    const total = await Client.countDocuments(query);
    
    res.status(200).json({
      success: true,
      data: clients,
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
      message: 'Error fetching clients',
      error: error.message,
    });
  }
};

module.exports = {
  approveNewClient,
  approveClientEdit,
  rejectClientCase,
  getClientById,
  listClients,
};
