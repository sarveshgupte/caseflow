const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { requireAdmin, blockSuperadmin } = require('../middleware/permission.middleware');
const {
  getAdminStats,
  resendInviteEmail,
  getAllOpenCases,
  getAllPendingCases,
  getAllFiledCases,
  getAllResolvedCases,
  updateRestrictedClients,
} = require('../controllers/admin.controller');

/**
 * Admin Routes
 * PR #41 - Admin panel statistics and management
 * PR #48 - Admin resend invite email
 * PR: Case Lifecycle - Admin case visibility endpoints
 * PR: Fix Case Lifecycle - Added resolved cases endpoint
 * All routes require authentication and admin role
 * Superadmin is blocked from accessing these routes (firm data)
 */

// GET /api/admin/stats - Get admin dashboard statistics
router.get('/stats', authenticate, blockSuperadmin, requireAdmin, getAdminStats);

// POST /api/admin/users/:xID/resend-invite - Resend invite email for user
// PR #48: Admin-only endpoint that bypasses password enforcement
router.post('/users/:xID/resend-invite', authenticate, blockSuperadmin, requireAdmin, resendInviteEmail);

// PATCH /api/admin/users/:xID/restrict-clients - Update user's client access restrictions
// Admin-only endpoint to manage client deny-list per user
router.patch('/users/:xID/restrict-clients', authenticate, blockSuperadmin, requireAdmin, updateRestrictedClients);

// GET /api/admin/cases/open - Get all open cases (admin view)
router.get('/cases/open', authenticate, blockSuperadmin, requireAdmin, getAllOpenCases);

// GET /api/admin/cases/pending - Get all pending cases (admin view)
router.get('/cases/pending', authenticate, blockSuperadmin, requireAdmin, getAllPendingCases);

// GET /api/admin/cases/filed - Get all filed cases (admin view)
router.get('/cases/filed', authenticate, blockSuperadmin, requireAdmin, getAllFiledCases);

// GET /api/admin/cases/resolved - Get all resolved cases (admin view)
router.get('/cases/resolved', authenticate, blockSuperadmin, requireAdmin, getAllResolvedCases);

module.exports = router;
