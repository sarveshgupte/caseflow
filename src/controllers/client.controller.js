const Client = require('../models/Client.model');
const Case = require('../models/Case.model');
const { generateNextClientId } = require('../services/clientIdGenerator');
const { CLIENT_STATUS } = require('../config/constants');

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
    
    // Special logic for Create Case: Always include Default Client + other active clients
    if (forCreateCase === 'true') {
      const clients = await Client.find({
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
    const filter = activeOnly === 'true' ? { status: CLIENT_STATUS.ACTIVE } : {};
    
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
    
    const client = await Client.findOne({ clientId });
    
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
    
    // STEP 6: Get creator xID from authenticated user (server-side only)
    const createdByXid = req.user?.xID;
    
    if (!createdByXid) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required - user xID not found',
      });
    }
    
    // STEP 7: Generate clientId server-side
    const clientId = await generateNextClientId();
    
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
    
    const client = await Client.findOne({ clientId });
    
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
    
    // HARD BLOCK: Prevent deactivation of Default Client (C000001)
    // This is a system invariant that must be enforced server-side
    if (clientId === 'C000001' && !isActive) {
      return res.status(400).json({
        success: false,
        message: 'Default client cannot be deactivated.',
      });
    }
    
    const client = await Client.findOne({ clientId });
    
    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found',
      });
    }
    
    // Additional check using isSystemClient flag
    if (client.isSystemClient && !isActive) {
      return res.status(400).json({
        success: false,
        message: 'Default client cannot be deactivated.',
      });
    }
    
    // Update both legacy and new status fields
    client.isActive = isActive;
    client.status = isActive ? 'ACTIVE' : 'INACTIVE';
    await client.save();
    
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
    
    const client = await Client.findOne({ clientId });
    
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
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Error changing client legal name',
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
};
