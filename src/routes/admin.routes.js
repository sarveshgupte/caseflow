const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { requireAdmin } = require('../middleware/permission.middleware');
const {
  getAdminStats,
} = require('../controllers/admin.controller');

/**
 * Admin Routes
 * PR #41 - Admin panel statistics and management
 * All routes require authentication and admin role
 */

// GET /api/admin/stats - Get admin dashboard statistics
router.get('/stats', authenticate, requireAdmin, getAdminStats);

module.exports = router;
