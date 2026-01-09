const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { requireAdmin } = require('../middleware/permission.middleware');
const {
  getAdminStats,
  resendInviteEmail,
} = require('../controllers/admin.controller');

/**
 * Admin Routes
 * PR #41 - Admin panel statistics and management
 * PR #48 - Admin resend invite email
 * All routes require authentication and admin role
 */

// GET /api/admin/stats - Get admin dashboard statistics
router.get('/stats', authenticate, requireAdmin, getAdminStats);

// POST /api/admin/users/:xID/resend-invite - Resend invite email for user
// PR #48: Admin-only endpoint that bypasses password enforcement
router.post('/users/:xID/resend-invite', authenticate, requireAdmin, resendInviteEmail);

module.exports = router;
