const Client = require('../models/Client.model');
const Case = require('../models/Case.model');

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
 */
const getClients = async (req, res) => {
  try {
    const { activeOnly } = req.query;
    
    // Filter based on activeOnly query parameter
    const filter = activeOnly === 'true' ? { isActive: true } : {};
    
    const clients = await Client.find(filter).sort({ createdAt: -1 });
    
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
 * clientId is auto-generated (e.g., C000002)
 * createdBy is set from authenticated user
 */
const createClient = async (req, res) => {
  try {
    const {
      businessName,
      businessAddress,
      businessPhone,
      businessEmail,
      PAN,
      GST,
      CIN,
      latitude,
      longitude,
    } = req.body;
    
    // Validate required fields
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
    
    if (!businessPhone || !businessPhone.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Business phone is required',
      });
    }
    
    if (!businessEmail || !businessEmail.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Business email is required',
      });
    }
    
    // Get admin email from authenticated user
    const createdBy = req.user?.email;
    
    if (!createdBy) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required - user email not found',
      });
    }
    
    // Create new client
    const client = new Client({
      businessName: businessName.trim(),
      businessAddress: businessAddress.trim(),
      businessPhone: businessPhone.trim(),
      businessEmail: businessEmail.trim().toLowerCase(),
      PAN: PAN ? PAN.trim().toUpperCase() : undefined,
      GST: GST ? GST.trim().toUpperCase() : undefined,
      CIN: CIN ? CIN.trim().toUpperCase() : undefined,
      latitude: latitude ? parseFloat(latitude) : undefined,
      longitude: longitude ? parseFloat(longitude) : undefined,
      isSystemClient: false,
      isActive: true,
      createdBy: createdBy.trim().toLowerCase(),
    });
    
    await client.save();
    
    res.status(201).json({
      success: true,
      data: client,
      message: 'Client created successfully',
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Error creating client',
      error: error.message,
    });
  }
};

/**
 * Update client (Admin only)
 * PUT /api/clients/:clientId
 * 
 * clientId is immutable and cannot be changed
 * isSystemClient cannot be changed
 */
const updateClient = async (req, res) => {
  try {
    const { clientId } = req.params;
    const {
      businessName,
      businessAddress,
      businessPhone,
      businessEmail,
      PAN,
      GST,
      CIN,
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
    
    // Validate required fields if provided
    if (businessName !== undefined) {
      if (!businessName.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Business name cannot be empty',
        });
      }
      client.businessName = businessName.trim();
    }
    
    if (businessAddress !== undefined) {
      if (!businessAddress.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Business address cannot be empty',
        });
      }
      client.businessAddress = businessAddress.trim();
    }
    
    if (businessPhone !== undefined) {
      if (!businessPhone.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Business phone cannot be empty',
        });
      }
      client.businessPhone = businessPhone.trim();
    }
    
    if (businessEmail !== undefined) {
      if (!businessEmail.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Business email cannot be empty',
        });
      }
      client.businessEmail = businessEmail.trim().toLowerCase();
    }
    
    // Update optional fields
    if (PAN !== undefined) {
      client.PAN = PAN ? PAN.trim().toUpperCase() : null;
    }
    
    if (GST !== undefined) {
      client.GST = GST ? GST.trim().toUpperCase() : null;
    }
    
    if (CIN !== undefined) {
      client.CIN = CIN ? CIN.trim().toUpperCase() : null;
    }
    
    if (latitude !== undefined) {
      client.latitude = latitude ? parseFloat(latitude) : null;
    }
    
    if (longitude !== undefined) {
      client.longitude = longitude ? parseFloat(longitude) : null;
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
    
    const client = await Client.findOne({ clientId });
    
    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found',
      });
    }
    
    // Prevent disabling system client
    if (client.isSystemClient && !isActive) {
      return res.status(403).json({
        success: false,
        message: 'System client cannot be disabled',
      });
    }
    
    client.isActive = isActive;
    await client.save();
    
    res.json({
      success: true,
      data: client,
      message: `Client ${isActive ? 'enabled' : 'disabled'} successfully`,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Error updating client status',
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
};
