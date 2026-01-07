const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { requireAdmin } = require('../middleware/permission.middleware');
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
  resendSetupEmail,
  updateUserStatus,
  unlockAccount,
} = require('../controllers/auth.controller');

/**
 * Authentication and User Management Routes
 * PART A & B - xID-based Authentication & Identity Management
 * 
 * Login endpoint is PUBLIC, all other endpoints require authentication
 */

// Public authentication endpoints - NO authentication required
router.post('/login', login);
router.post('/set-password', setPassword);

// Protected authentication endpoints - require authentication
router.post('/logout', authenticate, logout);
router.post('/change-password', authenticate, changePassword);

// Profile endpoints - require authentication
router.get('/profile', authenticate, getProfile);
router.put('/profile', authenticate, updateProfile);

// Admin-only endpoints - require authentication and admin role
router.post('/reset-password', authenticate, requireAdmin, resetPassword);
router.post('/resend-setup-email', authenticate, requireAdmin, resendSetupEmail);
router.post('/unlock-account', authenticate, requireAdmin, unlockAccount);
router.post('/admin/users', authenticate, requireAdmin, createUser);
router.put('/admin/users/:xID/activate', authenticate, requireAdmin, activateUser);
router.put('/admin/users/:xID/deactivate', authenticate, requireAdmin, deactivateUser);

module.exports = router;
