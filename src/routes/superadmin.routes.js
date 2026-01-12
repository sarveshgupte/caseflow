const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { requireSuperadmin } = require('../middleware/permission.middleware');
const { authorize } = require('../middleware/authorize');
const SuperAdminPolicy = require('../policies/superadmin.policy');
const FirmPolicy = require('../policies/firm.policy');
const { superadminLimiter } = require('../middleware/rateLimiters');
const {
  createFirm,
  listFirms,
  updateFirmStatus,
  createFirmAdmin,
  getPlatformStats,
  disableFirmImmediately,
  getOperationalHealth,
} = require('../controllers/superadmin.controller');

/**
 * Superadmin Routes
 * 
 * Platform-level management routes for Superadmin only
 * All routes require authentication and SUPER_ADMIN role
 * Rate limited to prevent abuse even from privileged accounts
 * 
 * Superadmin can:
 * - Create and manage firms
 * - Activate/suspend firms
 * - Create firm admins
 * - View platform statistics
 * 
 * Superadmin CANNOT:
 * - Access firm data (cases, clients, tasks, attachments)
 * - Be seen or managed by firm admins
 */

// Platform statistics
router.get('/stats', authenticate, authorize(SuperAdminPolicy.canViewPlatformStats), superadminLimiter, getPlatformStats);
router.get('/health', authenticate, requireSuperadmin, superadminLimiter, getOperationalHealth);

// Firm management
router.post('/firms', authenticate, authorize(FirmPolicy.canCreate), superadminLimiter, createFirm);
router.get('/firms', authenticate, authorize(FirmPolicy.canView), superadminLimiter, listFirms);
router.patch('/firms/:id', authenticate, authorize(FirmPolicy.canManageStatus), superadminLimiter, updateFirmStatus);
router.post('/firms/:id/disable', authenticate, authorize(FirmPolicy.canManageStatus), superadminLimiter, disableFirmImmediately);

// Firm admin creation
router.post('/firms/:firmId/admin', authenticate, authorize(FirmPolicy.canCreateAdmin), superadminLimiter, createFirmAdmin);

module.exports = router;
