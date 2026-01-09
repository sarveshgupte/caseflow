const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { requireAdmin } = require('../middleware/permission.middleware');
const {
  getAdminStats,
  resendInviteEmail,
  getAllOpenCases,
  getAllPendingCases,
  getAllFiledCases,
  getAllResolvedCases,
} = require('../controllers/admin.controller');

/**
 * Admin Routes
 * PR #41 - Admin panel statistics and management
 * PR #48 - Admin resend invite email
 * PR: Case Lifecycle - Admin case visibility endpoints
 * PR: Fix Case Lifecycle - Added resolved cases endpoint
 * All routes require authentication and admin role
 */

// GET /api/admin/stats - Get admin dashboard statistics
router.get('/stats', authenticate, requireAdmin, getAdminStats);

// POST /api/admin/users/:xID/resend-invite - Resend invite email for user
// PR #48: Admin-only endpoint that bypasses password enforcement
router.post('/users/:xID/resend-invite', authenticate, requireAdmin, resendInviteEmail);

// GET /api/admin/cases/open - Get all open cases (admin view)
router.get('/cases/open', authenticate, requireAdmin, getAllOpenCases);

// GET /api/admin/cases/pending - Get all pending cases (admin view)
router.get('/cases/pending', authenticate, requireAdmin, getAllPendingCases);

// GET /api/admin/cases/filed - Get all filed cases (admin view)
router.get('/cases/filed', authenticate, requireAdmin, getAllFiledCases);

// GET /api/admin/cases/resolved - Get all resolved cases (admin view)
router.get('/cases/resolved', authenticate, requireAdmin, getAllResolvedCases);

module.exports = router;
