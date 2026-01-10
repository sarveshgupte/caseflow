const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { requireAdmin } = require('../middleware/permission.middleware');
const { optionalFirmResolution } = require('../middleware/firmResolution.middleware');
const { authLimiter } = require('../middleware/rateLimiters');
const {
  login,
  logout,
  changePassword,
  resetPassword,
  getProfile,
  updateProfile,
  createUser,
  activateUser,
  deactivateUser,
  setPassword,
  resetPasswordWithToken,
  updateUserStatus,
  unlockAccount,
  forgotPassword,
  getAllUsers,
  refreshAccessToken, // NEW: JWT token refresh
} = require('../controllers/auth.controller');

/**
 * Authentication and User Management Routes
 * PART A & B - xID-based Authentication & Identity Management
 * 
 * Login endpoint is PUBLIC, all other endpoints require authentication
 */

// Public authentication endpoints - NO authentication required
// Login supports optional firm resolution for firm-scoped login
// Rate limited to prevent brute-force attacks
router.post('/login', authLimiter, optionalFirmResolution, login);
router.post('/set-password', authLimiter, setPassword);
router.post('/reset-password-with-token', authLimiter, resetPasswordWithToken);
router.post('/forgot-password', authLimiter, forgotPassword);
router.post('/refresh', refreshAccessToken); // NEW: JWT token refresh

// Protected authentication endpoints - require authentication
router.post('/logout', authenticate, logout);
router.post('/change-password', authenticate, changePassword);

// Profile endpoints - require authentication
router.get('/profile', authenticate, getProfile);
router.put('/profile', authenticate, updateProfile);

// Admin-only endpoints - require authentication and admin role
router.post('/reset-password', authenticate, requireAdmin, resetPassword);
// NOTE: resend-setup-email has been moved to /api/admin/users/:xID/resend-invite (PR #48)
// This ensures admin actions bypass password enforcement middleware
router.post('/unlock-account', authenticate, requireAdmin, unlockAccount);
router.get('/admin/users', authenticate, requireAdmin, getAllUsers);
router.post('/admin/users', authenticate, requireAdmin, createUser);
router.put('/admin/users/:xID/activate', authenticate, requireAdmin, activateUser);
router.put('/admin/users/:xID/deactivate', authenticate, requireAdmin, deactivateUser);

module.exports = router;
