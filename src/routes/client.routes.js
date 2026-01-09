const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { requireAdmin } = require('../middleware/permission.middleware');
const {
  getClients,
  getClientById,
  createClient,
  updateClient,
  toggleClientStatus,
  changeLegalName,
} = require('../controllers/client.controller');

/**
 * Client Management Routes
 * 
 * PR #39: Direct client management for Admin users
 * Admin can create, edit (restricted fields), enable/disable clients
 * No hard deletes allowed - only soft delete via isActive/status flag
 * 
 * PR #49: Client lifecycle governance
 * - Business name changes only via dedicated endpoint with audit trail
 * - PAN/TAN/CIN are immutable
 * - Only email and contact numbers can be updated normally
 */

// Public/authenticated endpoints
router.get('/', authenticate, getClients);
router.get('/:clientId', authenticate, getClientById);

// Admin-only endpoints
router.post('/', authenticate, requireAdmin, createClient);
router.put('/:clientId', authenticate, requireAdmin, updateClient);
router.patch('/:clientId/status', authenticate, requireAdmin, toggleClientStatus);
router.post('/:clientId/change-name', authenticate, requireAdmin, changeLegalName);

module.exports = router;
