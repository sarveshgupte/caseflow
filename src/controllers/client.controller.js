const Client = require('../models/Client.model');
const Case = require('../models/Case.model');
const { generateNextClientId } = require('../services/clientIdGenerator');
const { CLIENT_STATUS } = require('../config/constants');
const { 
  logFactSheetCreated, 
  logFactSheetUpdated, 
  logFactSheetFileAdded, 
  logFactSheetFileRemoved 
} = require('../services/clientFactSheetAudit.service');
const { getMimeType } = require('../utils/fileUtils');
const path = require('path');
const fs = require('fs').promises;

/**
 * Client Controller for Direct Client Management
 * 
 * PR #39: Admin can directly manage clients
 * Key Features:
 * - Auto-generated immutable clientId
 * - Create, edit, enable/disable operations
 * - No hard deletes - only soft delete via isActive flag
 * - Disabled clients cannot be used for new cases
 */

/**
 * Get all clients
 * GET /api/clients
 * Query param: activeOnly=true for only active clients
 * Query param: forCreateCase=true to get clients for case creation (always includes Default Client)
 */
const getClients = async (req, res) => {
  try {
    const { activeOnly, forCreateCase } = req.query;
    
    // Get firmId from authenticated user for query scoping
    const userFirmId = req.user?.firmId;
    
    // Ensure user has a firmId (SUPER_ADMIN won't have firmId)
    if (!userFirmId && req.user?.role !== 'SUPER_ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'User must belong to a firm to access clients',
      });
    }
    
    // Base filter: scope by firmId (except for SUPER_ADMIN)
    const baseFilter = req.user?.role === 'SUPER_ADMIN' ? {} : { firmId: userFirmId };
    
    // Special logic for Create Case: Always include Default Client + other active clients
    if (forCreateCase === 'true') {
      const clients = await Client.find({
        ...baseFilter,
        $or: [
          { clientId: 'C000001' }, // Always include Default Client
          { status: CLIENT_STATUS.ACTIVE } // Include other active clients
        ]
      })
        .select('clientId businessName status')
        .sort({ clientId: 1 });
      
      return res.json({
        success: true,
        data: clients,
      });
    }
    
    // Filter based on activeOnly query parameter
    // Use canonical status field (ACTIVE/INACTIVE) instead of deprecated isActive
    const filter = { 
      ...baseFilter,
      ...(activeOnly === 'true' ? { status: CLIENT_STATUS.ACTIVE } : {})
    };
    
    const clients = await Client.find(filter)
      .select('clientId businessName status') // Select necessary fields (status is canonical)
      .sort({ clientId: 1 }); // Sort by clientId for consistency
    
    res.json({
      success: true,
      data: clients,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching clients',
      error: error.message,
    });
  }
};

/**
 * Get client by clientId
 * GET /api/clients/:clientId
 */
const getClientById = async (req, res) => {
  try {
    const { clientId } = req.params;
    
    // Get firmId from authenticated user for query scoping
    const userFirmId = req.user?.firmId;
    
    // Ensure user has a firmId (SUPER_ADMIN won't have firmId)
    if (!userFirmId && req.user?.role !== 'SUPER_ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'User must belong to a firm to access clients',
      });
    }
    
    // Build query with firmId scoping (except for SUPER_ADMIN)
    const query = { clientId };
    if (req.user?.role !== 'SUPER_ADMIN') {
      query.firmId = userFirmId;
    }
    
    const client = await Client.findOne(query);
    
    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found',
      });
    }
    
    res.json({
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
 * Create a new client (Admin only)
 * POST /api/clients
 * 
 * System-owned fields (auto-generated server-side):
 * - clientId: Auto-generated (e.g., C000002)
 * - createdByXid: Set from authenticated user (req.user.xID)
 * - status: Defaults to ACTIVE
 * 
 * Business fields (required from frontend):
 * - businessName, businessAddress, primaryContactNumber, businessEmail
 * 
 * Optional fields:
 * - secondaryContactNumber, PAN, GST, TAN, CIN, latitude, longitude
 */
const createClient = async (req, res) => {
  try {
    // STEP 1: Sanitize input - Remove empty, null, undefined values
    const sanitizedBody = Object.fromEntries(
      Object.entries(req.body).filter(
        ([key, value]) => value !== '' && value !== null && value !== undefined
      )
    );
    
    // STEP 2: Unconditionally strip forbidden/deprecated fields
    // NOTE: These fields are also not in the allowedFields whitelist (STEP 3),
    // but we explicitly delete them here as a defensive measure and to make
    // the intent clear that these fields must NEVER be accepted.
    ['latitude', 'longitude', 'businessPhone'].forEach(field => {
      delete sanitizedBody[field];
    });
    
    // STEP 3: Define allowed fields (whitelist approach)
    const allowedFields = [
      'businessName',
      'businessAddress',
      'businessEmail',
      'primaryContactNumber',
      'secondaryContactNumber',
      'PAN',
      'TAN',
      'GST',
      'CIN'
    ];
    
    // STEP 4: Reject unexpected fields
    const unexpectedFields = Object.keys(sanitizedBody).filter(
      key => !allowedFields.includes(key)
    );
    
    if (unexpectedFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Unexpected field(s) in client payload: ${unexpectedFields.join(', ')}`,
      });
    }
    
    // STEP 5: Extract and validate required business fields
    const {
      businessName,
      businessAddress,
      primaryContactNumber,
      businessEmail,
      secondaryContactNumber,
      PAN,
      GST,
      TAN,
      CIN,
    } = sanitizedBody;
    
    // Validate required business fields
    if (!businessName || !businessName.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Business name is required',
      });
    }
    
    if (!businessAddress || !businessAddress.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Business address is required',
      });
    }
    
    if (!primaryContactNumber || !primaryContactNumber.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Primary contact number is required',
      });
    }
    
    if (!businessEmail || !businessEmail.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Business email is required',
      });
    }
    
    // STEP 6: Get creator xID and firmId from authenticated user (server-side only)
    const createdByXid = req.user?.xID;
    const userFirmId = req.user?.firmId;
    
    if (!createdByXid) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required - user xID not found',
      });
    }
    
    // Ensure user has a firmId (required for creating clients)
    if (!userFirmId) {
      return res.status(403).json({
        success: false,
        message: 'User must belong to a firm to create clients',
      });
    }
    
    // STEP 7: Generate clientId server-side
    const clientId = await generateNextClientId(userFirmId);
    
    // STEP 8: Create new client with explicit field mapping
    const client = new Client({
      // System-generated ID (NEVER from client)
      clientId,
      // Business fields from sanitized request
      businessName: businessName.trim(),
      businessAddress: businessAddress.trim(),
      primaryContactNumber: primaryContactNumber.trim(),
      secondaryContactNumber: secondaryContactNumber ? secondaryContactNumber.trim() : undefined,
      businessEmail: businessEmail.trim().toLowerCase(),
      PAN: PAN ? PAN.trim().toUpperCase() : undefined,
      GST: GST ? GST.trim().toUpperCase() : undefined,
      TAN: TAN ? TAN.trim().toUpperCase() : undefined,
      CIN: CIN ? CIN.trim().toUpperCase() : undefined,
      // System-owned fields (injected server-side only, NEVER from client)
      firmId: userFirmId, // Set from authenticated user's firm
      createdByXid, // CANONICAL - set from auth context
      createdBy: req.user?.email ? req.user.email.trim().toLowerCase() : undefined, // DEPRECATED - backward compatibility only
      isSystemClient: false,
      isActive: true, // Legacy field
      status: 'ACTIVE', // New field
      previousBusinessNames: [], // Initialize empty history
    });
    
    await client.save();
    
    res.status(201).json({
      success: true,
      data: client,
      message: 'Client created successfully',
    });
  } catch (error) {
    // Enhanced error logging for debugging
    // NOTE: In production, consider using structured logging with appropriate log levels
    console.error('❌ Client creation failed');
    console.error('Error message:', error.message);
    if (error.errors) {
      console.error('Validation errors:', error.errors);
    }
    
    res.status(400).json({
      success: false,
      message: error.message || 'Error creating client',
      ...(error.errors && { validationErrors: error.errors }),
    });
  }
};

/**
 * Update client (Admin only)
 * PUT /api/clients/:clientId
 * 
 * RESTRICTED FIELDS - Only these fields can be updated:
 * - businessEmail
 * - primaryContactNumber
 * - secondaryContactNumber
 * 
 * IMMUTABLE FIELDS - These cannot be changed:
 * - clientId
 * - businessName (use changeLegalName endpoint instead)
 * - PAN, TAN, CIN
 * - createdByXid
 * - isSystemClient
 */
const updateClient = async (req, res) => {
  try {
    const { clientId } = req.params;
    const {
      businessEmail,
      primaryContactNumber,
      secondaryContactNumber,
      // Explicitly list fields that should be rejected
      businessName,
      PAN,
      TAN,
      CIN,
      businessAddress,
      GST,
      latitude,
      longitude,
    } = req.body;
    
    // Get firmId from authenticated user for query scoping
    const userFirmId = req.user?.firmId;
    
    // Ensure user has a firmId
    if (!userFirmId) {
      return res.status(403).json({
        success: false,
        message: 'User must belong to a firm to update clients',
      });
    }
    
    // Build query with firmId scoping
    const client = await Client.findOne({ clientId, firmId: userFirmId });
    
    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found',
      });
    }
    
    // Prevent editing system client
    if (client.isSystemClient) {
      return res.status(403).json({
        success: false,
        message: 'System client cannot be edited',
      });
    }
    
    // Explicitly reject attempts to update businessName
    if (businessName !== undefined) {
      return res.status(400).json({
        success: false,
        message: 'Business name cannot be updated through this endpoint. Use the "Change Legal Name" action instead.',
      });
    }
    
    // Explicitly reject attempts to update immutable regulatory fields
    if (PAN !== undefined || TAN !== undefined || CIN !== undefined) {
      return res.status(400).json({
        success: false,
        message: 'PAN, TAN, and CIN are immutable and cannot be modified after creation.',
      });
    }
    
    // Reject attempts to update other non-editable fields
    if (businessAddress !== undefined || GST !== undefined || 
        latitude !== undefined || longitude !== undefined) {
      return res.status(400).json({
        success: false,
        message: 'Only businessEmail, primaryContactNumber, and secondaryContactNumber can be updated.',
      });
    }
    
    // Update allowed fields
    if (businessEmail !== undefined) {
      if (!businessEmail.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Business email cannot be empty',
        });
      }
      client.businessEmail = businessEmail.trim().toLowerCase();
    }
    
    if (primaryContactNumber !== undefined) {
      if (!primaryContactNumber.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Primary contact number cannot be empty',
        });
      }
      client.primaryContactNumber = primaryContactNumber.trim();
    }
    
    if (secondaryContactNumber !== undefined) {
      client.secondaryContactNumber = secondaryContactNumber ? secondaryContactNumber.trim() : null;
    }
    
    await client.save();
    
    res.json({
      success: true,
      data: client,
      message: 'Client updated successfully',
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Error updating client',
      error: error.message,
    });
  }
};

/**
 * Enable/disable client (Admin only)
 * PATCH /api/clients/:clientId/status
 * 
 * Disabled clients cannot be used for new cases
 * System client (C000001) cannot be disabled
 */
const toggleClientStatus = async (req, res) => {
  try {
    const { clientId } = req.params;
    const { isActive } = req.body;
    
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'isActive field is required (boolean)',
      });
    }
    
    // Get firmId from authenticated user for query scoping
    const userFirmId = req.user?.firmId;
    
    // Ensure user has a firmId
    if (!userFirmId) {
      return res.status(403).json({
        success: false,
        message: 'User must belong to a firm to update clients',
      });
    }
    
    // Build query with firmId scoping
    const client = await Client.findOne({ clientId, firmId: userFirmId });
    
    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found',
      });
    }
    
    // PROTECTION: Prevent deactivation of system/internal clients
    // Check multiple flags to ensure firm's operational identity is protected
    const isProtectedClient = 
      client.isSystemClient === true || 
      client.isInternal === true || 
      clientId === 'C000001';
    
    if (isProtectedClient && !isActive) {
      // Log the attempt for audit
      console.warn(`[CLIENT_PROTECTION] Attempt to deactivate protected client ${clientId} by user ${req.user?.xID}`);
      
      return res.status(403).json({
        success: false,
        message: 'Cannot deactivate the default internal client. This is a protected system entity.',
      });
    }
    
    // Update both legacy and new status fields
    client.isActive = isActive;
    client.status = isActive ? 'ACTIVE' : 'INACTIVE';
    await client.save();
    
    console.log(`[CLIENT_STATUS] Client ${clientId} ${isActive ? 'activated' : 'deactivated'} by ${req.user?.xID}`);
    
    res.json({
      success: true,
      data: client,
      message: `Client ${isActive ? 'activated' : 'deactivated'} successfully`,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Error updating client status',
      error: error.message,
    });
  }
};

/**
 * Change client legal name (Admin only)
 * POST /api/clients/:clientId/change-name
 * 
 * This is the ONLY way to change a client's business name after creation.
 * Requires:
 * - newBusinessName: The new legal name
 * - reason: Explanation for the name change (required for audit compliance)
 * 
 * The old name is automatically archived in previousBusinessNames array
 * with metadata about when, who, and why the change was made.
 */
const changeLegalName = async (req, res) => {
  try {
    const { clientId } = req.params;
    const { newBusinessName, reason } = req.body;
    
    // Validate inputs
    if (!newBusinessName || !newBusinessName.trim()) {
      return res.status(400).json({
        success: false,
        message: 'New business name is required',
      });
    }
    
    if (!reason || !reason.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Reason for name change is required for audit compliance',
      });
    }
    
    // Get firmId from authenticated user for query scoping
    const userFirmId = req.user?.firmId;
    
    // Ensure user has a firmId
    if (!userFirmId) {
      return res.status(403).json({
        success: false,
        message: 'User must belong to a firm to update clients',
      });
    }
    
    // Build query with firmId scoping
    const client = await Client.findOne({ clientId, firmId: userFirmId });
    
    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found',
      });
    }
    
    // Prevent editing system client
    if (client.isSystemClient) {
      return res.status(403).json({
        success: false,
        message: 'System client name cannot be changed',
      });
    }
    
    // Get user xID for audit trail
    const changedByXid = req.user?.xID;
    if (!changedByXid) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required - user xID not found',
      });
    }
    
    // Archive current name in history
    const oldName = client.businessName;
    if (!client.previousBusinessNames) {
      client.previousBusinessNames = [];
    }
    
    client.previousBusinessNames.push({
      name: oldName,
      changedOn: new Date(),
      changedByXid: changedByXid,
      reason: reason.trim(),
    });
    
    // Update to new name
    client.businessName = newBusinessName.trim();
    
    await client.save();
    
    res.json({
      success: true,
      data: client,
      message: 'Client legal name changed successfully',
      nameChangeHistory: {
        oldName,
        newName: newBusinessName.trim(),
        changedBy: changedByXid,
        changedOn: new Date(),
        reason: reason.trim(),
      },
    });
  }
};

/**
 * Update Client Fact Sheet (Admin Only)
 * PUT /api/clients/:clientId/fact-sheet
 * 
 * Allows admin to update description and notes for client fact sheet
 * Files are managed via separate endpoints
 */
const updateClientFactSheet = async (req, res) => {
  try {
    const { clientId } = req.params;
    const { description, notes } = req.body;
    
    // Get firmId from authenticated user
    const userFirmId = req.user?.firmId;
    const performedByXID = req.user?.xID;
    
    if (!userFirmId) {
      return res.status(403).json({
        success: false,
        message: 'User must belong to a firm to update clients',
      });
    }
    
    if (!performedByXID) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required - user xID not found',
      });
    }
    
    // Find client with firmId scoping
    const client = await Client.findOne({ clientId, firmId: userFirmId });
    
    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found',
      });
    }
    
    // Initialize clientFactSheet if it doesn't exist
    if (!client.clientFactSheet) {
      client.clientFactSheet = { files: [] };
    }
    
    // Track if this is creation or update for audit logging
    const isCreation = !client.clientFactSheet.description && !client.clientFactSheet.notes;
    
    // Update description and notes
    if (description !== undefined) {
      client.clientFactSheet.description = description;
    }
    if (notes !== undefined) {
      client.clientFactSheet.notes = notes;
    }
    
    await client.save();
    
    // Log audit event
    if (isCreation) {
      await logFactSheetCreated({
        clientId,
        firmId: userFirmId,
        performedByXID,
        metadata: {
          hasDescription: !!description,
          hasNotes: !!notes,
        },
      });
    } else {
      await logFactSheetUpdated({
        clientId,
        firmId: userFirmId,
        performedByXID,
        metadata: {
          updatedDescription: description !== undefined,
          updatedNotes: notes !== undefined,
        },
      });
    }
    
    res.json({
      success: true,
      data: client.clientFactSheet,
      message: 'Client Fact Sheet updated successfully',
    });
  } catch (error) {
    console.error('Error updating client fact sheet:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating client fact sheet',
      error: error.message,
    });
  }
};

/**
 * Upload file to Client Fact Sheet (Admin Only)
 * POST /api/clients/:clientId/fact-sheet/files
 * 
 * Requires multer middleware for file upload
 */
const uploadFactSheetFile = async (req, res) => {
  try {
    const { clientId } = req.params;
    
    // Get firmId and xID from authenticated user
    const userFirmId = req.user?.firmId;
    const performedByXID = req.user?.xID;
    const userId = req.user?._id;
    
    if (!userFirmId || !performedByXID || !userId) {
      return res.status(403).json({
        success: false,
        message: 'Authentication required',
      });
    }
    
    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded',
      });
    }
    
    // Find client with firmId scoping
    const client = await Client.findOne({ clientId, firmId: userFirmId });
    
    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found',
      });
    }
    
    // Initialize clientFactSheet if it doesn't exist
    if (!client.clientFactSheet) {
      client.clientFactSheet = { description: '', notes: '', files: [] };
    }
    if (!client.clientFactSheet.files) {
      client.clientFactSheet.files = [];
    }
    
    // Get MIME type
    const mimeType = getMimeType(req.file.originalname) || req.file.mimetype || 'application/octet-stream';
    
    // Add file to client fact sheet
    const newFile = {
      fileName: req.file.originalname,
      mimeType,
      storagePath: req.file.path,
      uploadedBy: userId,
      uploadedAt: new Date(),
    };
    
    client.clientFactSheet.files.push(newFile);
    await client.save();
    
    // Get the newly added file (with generated fileId)
    const addedFile = client.clientFactSheet.files[client.clientFactSheet.files.length - 1];
    
    // Log audit event
    await logFactSheetFileAdded({
      clientId,
      firmId: userFirmId,
      performedByXID,
      fileName: req.file.originalname,
      metadata: {
        fileId: addedFile.fileId.toString(),
        mimeType,
        fileSize: req.file.size,
      },
    });
    
    res.status(201).json({
      success: true,
      data: addedFile,
      message: 'File uploaded successfully',
    });
  } catch (error) {
    console.error('Error uploading fact sheet file:', error);
    res.status(500).json({
      success: false,
      message: 'Error uploading file',
      error: error.message,
    });
  }
};

/**
 * Delete file from Client Fact Sheet (Admin Only)
 * DELETE /api/clients/:clientId/fact-sheet/files/:fileId
 */
const deleteFactSheetFile = async (req, res) => {
  try {
    const { clientId, fileId } = req.params;
    
    // Get firmId and xID from authenticated user
    const userFirmId = req.user?.firmId;
    const performedByXID = req.user?.xID;
    
    if (!userFirmId || !performedByXID) {
      return res.status(403).json({
        success: false,
        message: 'Authentication required',
      });
    }
    
    // Find client with firmId scoping
    const client = await Client.findOne({ clientId, firmId: userFirmId });
    
    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found',
      });
    }
    
    // Check if clientFactSheet exists
    if (!client.clientFactSheet || !client.clientFactSheet.files) {
      return res.status(404).json({
        success: false,
        message: 'No files found',
      });
    }
    
    // Find file to delete
    const fileIndex = client.clientFactSheet.files.findIndex(
      f => f.fileId.toString() === fileId
    );
    
    if (fileIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'File not found',
      });
    }
    
    const fileToDelete = client.clientFactSheet.files[fileIndex];
    
    // Delete physical file
    try {
      await fs.unlink(fileToDelete.storagePath);
    } catch (error) {
      console.error('Error deleting physical file:', error);
      // Continue even if physical file deletion fails
    }
    
    // Remove file from array
    client.clientFactSheet.files.splice(fileIndex, 1);
    await client.save();
    
    // Log audit event
    await logFactSheetFileRemoved({
      clientId,
      firmId: userFirmId,
      performedByXID,
      fileName: fileToDelete.fileName,
      metadata: {
        fileId,
      },
    });
    
    res.json({
      success: true,
      message: 'File deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting fact sheet file:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting file',
      error: error.message,
    });
  }
};

module.exports = {
  getClients,
  getClientById,
  createClient,
  updateClient,
  toggleClientStatus,
  changeLegalName,
  updateClientFactSheet,
  uploadFactSheetFile,
  deleteFactSheetFile,
};
