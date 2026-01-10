const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { requireSuperadmin } = require('../middleware/permission.middleware');
const {
  createFirm,
  listFirms,
  updateFirmStatus,
  createFirmAdmin,
} = require('../controllers/superadmin.controller');

/**
 * Superadmin Routes
 * 
 * Platform-level management routes for Superadmin only
 * All routes require authentication and SUPER_ADMIN role
 * 
 * Superadmin can:
 * - Create and manage firms
 * - Activate/suspend firms
 * - Create firm admins
 * 
 * Superadmin CANNOT:
 * - Access firm data (cases, clients, tasks, attachments)
 * - Be seen or managed by firm admins
 */

// Firm management
router.post('/firms', authenticate, requireSuperadmin, createFirm);
router.get('/firms', authenticate, requireSuperadmin, listFirms);
router.patch('/firms/:id', authenticate, requireSuperadmin, updateFirmStatus);

// Firm admin creation
router.post('/firms/:firmId/admin', authenticate, requireSuperadmin, createFirmAdmin);

module.exports = router;
