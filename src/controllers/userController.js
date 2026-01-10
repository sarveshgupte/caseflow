const User = require('../models/User.model');

/**
 * User Controller
 * Handles all user-related business logic
 */

/**
 * Get all users
 */
const getUsers = async (req, res) => {
  try {
    const { page = 1, limit = 20, role, isActive } = req.query;
    
    const query = {};
    if (role) query.role = role;
    if (isActive !== undefined) query.isActive = isActive === 'true';
    
    const users = await User.find(query)
      .select('-passwordHash -passwordSetupTokenHash -passwordHistory')
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .sort({ createdAt: -1 });
    
    const total = await User.countDocuments(query);
    
    res.json({
      success: true,
      data: users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error fetching users',
      message: error.message,
    });
  }
};

/**
 * Get single user by ID
 */
const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }
    
    res.json({
      success: true,
      data: user.toSafeObject(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error fetching user',
      message: error.message,
    });
  }
};

/**
 * Create new user
 */
const createUser = async (req, res) => {
  try {
    const { name, email, role } = req.body;
    
    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'User with this email already exists',
      });
    }
    
    const user = new User({
      name,
      email,
      role,
      createdBy: req.body.createdBy, // In real app, this comes from auth
    });
    
    await user.save();
    
    res.status(201).json({
      success: true,
      data: user.toSafeObject(),
      message: 'User created successfully',
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: 'Error creating user',
      message: error.message,
    });
  }
};

/**
 * Update user
 */
const updateUser = async (req, res) => {
  try {
    const { name, role, isActive, firmId, xID } = req.body;
    
    // Block attempts to modify immutable fields
    if (firmId !== undefined || xID !== undefined) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Cannot modify immutable fields (firmId, xID)',
      });
    }
    
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }
    
    if (name) user.name = name;
    if (role) user.role = role;
    if (isActive !== undefined) user.isActive = isActive;
    user.updatedBy = req.body.updatedBy; // In real app, this comes from auth
    
    await user.save();
    
    res.json({
      success: true,
      data: user.toSafeObject(),
      message: 'User updated successfully',
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: 'Error updating user',
      message: error.message,
    });
  }
};

/**
 * Delete user (soft delete by setting isActive to false)
 */
const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }
    
    // PROTECTION: Prevent deactivation of system users (default admin)
    if (user.isSystem === true) {
      return res.status(403).json({
        success: false,
        error: 'Cannot deactivate the default admin user. This is a protected system entity.',
      });
    }
    
    user.isActive = false;
    user.updatedBy = req.body.updatedBy; // In real app, this comes from auth
    await user.save();
    
    res.json({
      success: true,
      message: 'User deactivated successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error deactivating user',
      message: error.message,
    });
  }
};

module.exports = {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
};
