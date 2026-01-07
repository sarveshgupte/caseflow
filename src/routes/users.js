const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../middleware/permission.middleware');
const { updateUserStatus } = require('../controllers/auth.controller');
const {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
} = require('../controllers/userController');

/**
 * User Routes
 * RESTful API endpoints for user management
 */

// GET /api/users - Get all users
router.get('/', getUsers);

// GET /api/users/:id - Get user by ID
router.get('/:id', getUserById);

// POST /api/users - Create new user
router.post('/', createUser);

// PUT /api/users/:id - Update user
router.put('/:id', updateUser);

// PATCH /api/users/:xID/status - Update user status (Admin only)
router.patch('/:xID/status', requireAdmin, updateUserStatus);

// DELETE /api/users/:id - Deactivate user
router.delete('/:id', deleteUser);

module.exports = router;
