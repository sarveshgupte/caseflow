const bcrypt = require('bcrypt');
const User = require('../models/User.model');
const UserProfile = require('../models/UserProfile.model');
const AuthAudit = require('../models/AuthAudit.model');
const emailService = require('../services/email.service');

/**
 * Authentication Controller for xID-based Enterprise Authentication
 * PART B - Identity and Authentication Management
 */

const SALT_ROUNDS = 10;
const PASSWORD_EXPIRY_DAYS = 60;
const PASSWORD_HISTORY_LIMIT = 5;
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_TIME = 15 * 60 * 1000; // 15 minutes in milliseconds
const PASSWORD_SETUP_TOKEN_EXPIRY_HOURS = 24;

/**
 * Login with xID and password
 * POST /api/auth/login
 */
const login = async (req, res) => {
  try {
    const { xID, password } = req.body;
    
    if (!xID || !password) {
      console.warn('[AUTH] Missing credentials in login attempt', {
        hasXID: !!xID,
        hasPassword: !!password,
        ip: req.ip,
      });
      
      return res.status(400).json({
        success: false,
        message: 'xID and password are required',
      });
    }
    
    // Find user by xID
    const user = await User.findOne({ xID: xID.toUpperCase() });
    
    if (!user) {
      // Log failed login attempt
      await AuthAudit.create({
        xID: xID.toUpperCase(),
        actionType: 'LoginFailed',
        description: `Login failed: User not found`,
        performedBy: xID.toUpperCase(),
        ipAddress: req.ip,
      });
      
      return res.status(401).json({
        success: false,
        message: 'Invalid xID or password',
      });
    }
    
    // Check if user is active
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account is deactivated',
      });
    }
    
    // Check if account is locked
    if (user.isLocked) {
      return res.status(403).json({
        success: false,
        message: 'Account is locked due to too many failed login attempts. Please try again later or contact an administrator.',
        lockedUntil: user.lockUntil,
      });
    }
    
    // Check if password has been set
    if (!user.passwordSet) {
      return res.status(403).json({
        success: false,
        message: 'Please set your password using the link sent to your email',
        passwordSetupRequired: true,
      });
    }
    
    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    
    if (!isValidPassword) {
      // Increment failed login attempts
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
      
      // Lock account if max attempts reached
      if (user.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
        user.lockUntil = new Date(Date.now() + LOCK_TIME);
        await user.save();
        
        // Log account lock
        await AuthAudit.create({
          xID: user.xID,
          actionType: 'AccountLocked',
          description: `Account locked due to ${MAX_FAILED_ATTEMPTS} failed login attempts`,
          performedBy: user.xID,
          ipAddress: req.ip,
        });
        
        return res.status(403).json({
          success: false,
          message: 'Account locked due to too many failed login attempts. Please try again in 15 minutes or contact an administrator.',
          lockedUntil: user.lockUntil,
        });
      }
      
      await user.save();
      
      // Log failed login attempt
      await AuthAudit.create({
        xID: user.xID,
        actionType: 'LoginFailed',
        description: `Login failed: Invalid password (attempt ${user.failedLoginAttempts})`,
        performedBy: user.xID,
        ipAddress: req.ip,
      });
      
      return res.status(401).json({
        success: false,
        message: 'Invalid xID or password',
        remainingAttempts: MAX_FAILED_ATTEMPTS - user.failedLoginAttempts,
      });
    }
    
    // Reset failed attempts on successful login
    if (user.failedLoginAttempts > 0 || user.lockUntil) {
      user.failedLoginAttempts = 0;
      user.lockUntil = null;
      await user.save();
    }
    
    // Check if password has expired
    const now = new Date();
    if (user.passwordExpiresAt < now) {
      // Log password expiry
      await AuthAudit.create({
        xID: user.xID,
        actionType: 'PasswordExpired',
        description: `Login attempt with expired password`,
        performedBy: user.xID,
        ipAddress: req.ip,
      });
      
      return res.status(403).json({
        success: false,
        message: 'Password has expired. Please change your password.',
        mustChangePassword: true,
      });
    }
    
    // Check if must change password
    if (user.mustChangePassword) {
      // Generate new secure password setup token
      const token = emailService.generateSecureToken();
      const tokenHash = emailService.hashToken(token);
      const tokenExpiry = new Date(Date.now() + PASSWORD_SETUP_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);
      
      // Update user with token
      user.passwordSetupTokenHash = tokenHash;
      user.passwordSetupExpires = tokenExpiry;
      await user.save();
      
      // Send password setup email
      let emailSent = false;
      try {
        await emailService.sendPasswordSetupEmail(user.email, user.name, token);
        emailSent = true;
      } catch (emailError) {
        console.error('Failed to send password setup email');
        // Continue even if email fails - user can request resend
      }
      
      // Log password setup email attempt
      try {
        await AuthAudit.create({
          xID: user.xID,
          actionType: emailSent ? 'PasswordSetupEmailSent' : 'PasswordSetupEmailFailed',
          description: emailSent ? 'Password setup required - email sent' : 'Password setup required - email failed to send',
          performedBy: user.xID,
          ipAddress: req.ip,
        });
      } catch (auditError) {
        console.error('Failed to create audit log for password setup email');
      }
      
      return res.status(403).json({
        success: false,
        message: 'Password setup required. Check your email.',
        mustChangePassword: true,
      });
    }
    
    // Log successful login
    await AuthAudit.create({
      xID: user.xID,
      actionType: 'Login',
      description: `User logged in successfully`,
      performedBy: user.xID,
      ipAddress: req.ip,
    });
    
    // Return user info (exclude sensitive fields)
    res.json({
      success: true,
      message: 'Login successful',
      data: {
        xID: user.xID,
        name: user.name,
        email: user.email,
        role: user.role,
        allowedCategories: user.allowedCategories,
        isActive: user.isActive,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error during login',
      error: error.message,
    });
  }
};

/**
 * Logout
 * POST /api/auth/logout
 */
const logout = async (req, res) => {
  try {
    // Get xID from authenticated user
    const xID = req.user.xID;
    
    // Log logout
    await AuthAudit.create({
      xID: xID,
      actionType: 'Logout',
      description: `User logged out`,
      performedBy: xID,
      ipAddress: req.ip,
    });
    
    res.json({
      success: true,
      message: 'Logout successful',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error during logout',
      error: error.message,
    });
  }
};

/**
 * Change password
 * POST /api/auth/change-password
 */
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'currentPassword and newPassword are required',
      });
    }
    
    // Get user from authenticated request
    const user = req.user;
    
    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.passwordHash);
    
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect',
      });
    }
    
    // Check if new password matches any of the last 5 passwords
    const passwordHistory = user.passwordHistory || [];
    
    for (const oldPassword of passwordHistory.slice(-PASSWORD_HISTORY_LIMIT)) {
      const isReused = await bcrypt.compare(newPassword, oldPassword.hash);
      if (isReused) {
        return res.status(400).json({
          success: false,
          message: 'Cannot reuse any of your last 5 passwords',
        });
      }
    }
    
    // Check if new password is same as current
    const isSameAsCurrent = await bcrypt.compare(newPassword, user.passwordHash);
    if (isSameAsCurrent) {
      return res.status(400).json({
        success: false,
        message: 'New password must be different from current password',
      });
    }
    
    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    
    // Add current password to history
    user.passwordHistory.push({
      hash: user.passwordHash,
      changedAt: new Date(),
    });
    
    // Keep only last 5 passwords in history
    if (user.passwordHistory.length > PASSWORD_HISTORY_LIMIT) {
      user.passwordHistory = user.passwordHistory.slice(-PASSWORD_HISTORY_LIMIT);
    }
    
    // Update password
    user.passwordHash = newPasswordHash;
    user.passwordLastChangedAt = new Date();
    user.passwordExpiresAt = new Date(Date.now() + PASSWORD_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
    user.mustChangePassword = false;
    
    await user.save();
    
    // Log password change
    await AuthAudit.create({
      xID: user.xID,
      actionType: 'PasswordChanged',
      description: `User changed their password`,
      performedBy: user.xID,
      ipAddress: req.ip,
    });
    
    res.json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error changing password',
      error: error.message,
    });
  }
};

/**
 * Reset password (Admin only) - Sends password setup email
 * POST /api/auth/reset-password
 */
const resetPassword = async (req, res) => {
  try {
    const { xID } = req.body;
    
    if (!xID) {
      return res.status(400).json({
        success: false,
        message: 'xID is required',
      });
    }
    
    // Get admin from authenticated request
    const admin = req.user;
    
    // Find user to reset
    const user = await User.findOne({ xID: xID.toUpperCase() });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }
    
    // Generate new secure password setup token
    const token = emailService.generateSecureToken();
    const tokenHash = emailService.hashToken(token);
    const tokenExpiry = new Date(Date.now() + PASSWORD_SETUP_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);
    
    // Reset password state
    user.passwordHash = null;
    user.passwordSet = false;
    user.passwordSetupTokenHash = tokenHash;
    user.passwordSetupExpires = tokenExpiry;
    user.mustChangePassword = false;
    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    
    await user.save();
    
    // Send password setup email
    try {
      await emailService.sendPasswordSetupEmail(user.email, user.name, token);
      
      // Log password setup email sent
      await AuthAudit.create({
        xID: user.xID,
        actionType: 'PasswordSetupEmailSent',
        description: `Password reset email sent to ${user.email}`,
        performedBy: admin.xID,
        ipAddress: req.ip,
      });
    } catch (emailError) {
      console.error('Failed to send password setup email:', emailError);
    }
    
    // Log password reset
    await AuthAudit.create({
      xID: user.xID,
      actionType: 'PasswordResetByAdmin',
      description: `Password reset by admin - setup email sent`,
      performedBy: admin.xID,
      ipAddress: req.ip,
      metadata: {
        resetBy: admin.xID,
      },
    });
    
    res.json({
      success: true,
      message: 'Password reset successfully. User will receive an email with setup instructions.',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error resetting password',
      error: error.message,
    });
  }
};

/**
 * Get user profile
 * GET /api/auth/profile
 */
const getProfile = async (req, res) => {
  try {
    // Get user from authenticated request
    const user = req.user;
    
    // Get profile info
    let profile = await UserProfile.findOne({ xID: user.xID });
    
    // If profile doesn't exist, create empty one
    if (!profile) {
      profile = {
        xID: user.xID,
        dob: null,
        phone: null,
        address: {},
        pan: null,
        aadhaar: null,
        email: null,
      };
    }
    
    res.json({
      success: true,
      data: {
        // Immutable fields from User model
        xID: user.xID,
        name: user.name,
        role: user.role,
        allowedCategories: user.allowedCategories,
        isActive: user.isActive,
        // Mutable fields from UserProfile model
        dob: profile.dob,
        phone: profile.phone,
        address: profile.address,
        pan: profile.pan,
        aadhaar: profile.aadhaar,
        email: profile.email || user.email,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching profile',
      error: error.message,
    });
  }
};

/**
 * Update user profile
 * PUT /api/auth/profile
 */
const updateProfile = async (req, res) => {
  try {
    const { dob, phone, address, pan, aadhaar, email } = req.body;
    
    // Get user from authenticated request
    const user = req.user;
    
    // Find or create profile
    let profile = await UserProfile.findOne({ xID: user.xID });
    
    const oldProfile = profile ? { ...profile.toObject() } : {};
    
    if (!profile) {
      profile = new UserProfile({ xID: user.xID });
    }
    
    // Update only provided fields
    if (dob !== undefined) profile.dob = dob;
    if (phone !== undefined) profile.phone = phone;
    if (address !== undefined) profile.address = address;
    if (pan !== undefined) profile.pan = pan;
    if (aadhaar !== undefined) profile.aadhaar = aadhaar;
    if (email !== undefined) profile.email = email;
    
    await profile.save();
    
    // Log profile update with old and new values
    const changes = {};
    if (dob !== undefined) changes.dob = { old: oldProfile.dob, new: dob };
    if (phone !== undefined) changes.phone = { old: oldProfile.phone, new: phone };
    if (address !== undefined) changes.address = { old: oldProfile.address, new: address };
    if (pan !== undefined) changes.pan = { old: oldProfile.pan, new: pan };
    if (aadhaar !== undefined) changes.aadhaar = { old: oldProfile.aadhaar, new: aadhaar };
    if (email !== undefined) changes.email = { old: oldProfile.email, new: email };
    
    await AuthAudit.create({
      xID: user.xID,
      actionType: 'ProfileUpdated',
      description: `User profile updated`,
      performedBy: user.xID,
      ipAddress: req.ip,
      metadata: {
        changes,
      },
    });
    
    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: profile,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating profile',
      error: error.message,
    });
  }
};

/**
 * Create user (Admin only)
 * POST /api/admin/users
 */
const createUser = async (req, res) => {
  try {
    const { xID, name, role, allowedCategories, email } = req.body;
    
    if (!xID || !name || !email) {
      return res.status(400).json({
        success: false,
        message: 'xID, name, and email are required',
      });
    }
    
    // Get admin from authenticated request
    const admin = req.user;
    
    // Check if user already exists
    const existingUser = await User.findOne({ 
      $or: [
        { xID: xID.toUpperCase() },
        { email: email.toLowerCase() }
      ]
    });
    
    if (existingUser) {
      if (existingUser.xID === xID.toUpperCase()) {
        return res.status(400).json({
          success: false,
          message: 'User with this xID already exists',
        });
      }
      if (existingUser.email === email.toLowerCase()) {
        return res.status(400).json({
          success: false,
          message: 'User with this email already exists',
        });
      }
    }
    
    // Generate secure password setup token
    const token = emailService.generateSecureToken();
    const tokenHash = emailService.hashToken(token);
    const tokenExpiry = new Date(Date.now() + PASSWORD_SETUP_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);
    
    // Create user without password
    const newUser = new User({
      xID: xID.toUpperCase(),
      name,
      email: email.toLowerCase(),
      role: role || 'Employee',
      allowedCategories: allowedCategories || [],
      isActive: true,
      passwordHash: null,
      passwordSet: false,
      passwordSetupTokenHash: tokenHash,
      passwordSetupExpires: tokenExpiry,
      mustChangePassword: false,
      passwordHistory: [],
    });
    
    await newUser.save();
    
    // Send password setup email
    try {
      await emailService.sendPasswordSetupEmail(newUser.email, newUser.name, token);
      
      // Log password setup email sent
      await AuthAudit.create({
        xID: newUser.xID,
        actionType: 'PasswordSetupEmailSent',
        description: `Password setup email sent to ${newUser.email}`,
        performedBy: admin.xID,
        ipAddress: req.ip,
      });
    } catch (emailError) {
      console.error('Failed to send password setup email:', emailError);
      // Don't fail user creation if email fails
    }
    
    // Log user creation
    await AuthAudit.create({
      xID: newUser.xID,
      actionType: 'UserCreated',
      description: `User account created by admin`,
      performedBy: admin.xID,
      ipAddress: req.ip,
      metadata: {
        createdBy: admin.xID,
        role: newUser.role,
      },
    });
    
    res.status(201).json({
      success: true,
      message: 'User created successfully. Password setup email sent.',
      data: {
        xID: newUser.xID,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        allowedCategories: newUser.allowedCategories,
        passwordSet: newUser.passwordSet,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating user',
      error: error.message,
    });
  }
};

/**
 * Activate user (Admin only)
 * PUT /api/admin/users/:xID/activate
 */
const activateUser = async (req, res) => {
  try {
    const { xID } = req.params;
    
    // Get admin from authenticated request
    const admin = req.user;
    
    // Find user
    const user = await User.findOne({ xID: xID.toUpperCase() });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }
    
    // Activate user
    user.isActive = true;
    await user.save();
    
    // Log activation
    await AuthAudit.create({
      xID: user.xID,
      actionType: 'AccountActivated',
      description: `User account activated by admin`,
      performedBy: admin.xID,
      ipAddress: req.ip,
    });
    
    res.json({
      success: true,
      message: 'User activated successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error activating user',
      error: error.message,
    });
  }
};

/**
 * Deactivate user (Admin only)
 * PUT /api/admin/users/:xID/deactivate
 */
const deactivateUser = async (req, res) => {
  try {
    const { xID } = req.params;
    
    // Get admin from authenticated request
    const admin = req.user;
    
    // Find user
    const user = await User.findOne({ xID: xID.toUpperCase() });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }
    
    // Deactivate user
    user.isActive = false;
    await user.save();
    
    // Log deactivation
    await AuthAudit.create({
      xID: user.xID,
      actionType: 'AccountDeactivated',
      description: `User account deactivated by admin`,
      performedBy: admin.xID,
      ipAddress: req.ip,
    });
    
    res.json({
      success: true,
      message: 'User deactivated successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deactivating user',
      error: error.message,
    });
  }
};

/**
 * Set password using token from email
 * POST /api/auth/set-password
 */
const setPassword = async (req, res) => {
  try {
    const { token, password } = req.body;
    
    if (!token || !password) {
      return res.status(400).json({
        success: false,
        message: 'Token and password are required',
      });
    }
    
    // Hash the token to compare with stored hash
    const tokenHash = emailService.hashToken(token);
    
    // Find user with matching token hash
    const user = await User.findOne({ 
      passwordSetupTokenHash: tokenHash,
      passwordSetupExpires: { $gt: new Date() }
    });
    
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired password setup token',
      });
    }
    
    // Hash new password
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    
    // Set password and clear token
    user.passwordHash = passwordHash;
    user.passwordSet = true;
    user.passwordSetupTokenHash = null;
    user.passwordSetupExpires = null;
    user.passwordLastChangedAt = new Date();
    user.passwordExpiresAt = new Date(Date.now() + PASSWORD_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
    user.mustChangePassword = false;
    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    
    await user.save();
    
    // Log password setup
    await AuthAudit.create({
      xID: user.xID,
      actionType: 'PasswordSetup',
      description: `User set password via email link`,
      performedBy: user.xID,
      ipAddress: req.ip,
    });
    
    res.json({
      success: true,
      message: 'Password set successfully. You can now log in.',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error setting password',
      error: error.message,
    });
  }
};

/**
 * Resend password setup email (Admin only)
 * POST /api/auth/resend-setup-email
 */
const resendSetupEmail = async (req, res) => {
  try {
    const { xID } = req.body;
    
    if (!xID) {
      return res.status(400).json({
        success: false,
        message: 'xID is required',
      });
    }
    
    // Get admin from authenticated request
    const admin = req.user;
    
    // Find user
    const user = await User.findOne({ xID: xID.toUpperCase() });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }
    
    if (user.passwordSet) {
      return res.status(400).json({
        success: false,
        message: 'User has already set their password',
      });
    }
    
    // Generate new secure password setup token
    const token = emailService.generateSecureToken();
    const tokenHash = emailService.hashToken(token);
    const tokenExpiry = new Date(Date.now() + PASSWORD_SETUP_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);
    
    // Update token
    user.passwordSetupTokenHash = tokenHash;
    user.passwordSetupExpires = tokenExpiry;
    await user.save();
    
    // Send password setup email
    try {
      await emailService.sendPasswordSetupReminderEmail(user.email, user.name, token);
      
      // Log password setup email sent
      await AuthAudit.create({
        xID: user.xID,
        actionType: 'PasswordSetupEmailSent',
        description: `Password setup reminder email sent to ${user.email}`,
        performedBy: admin.xID,
        ipAddress: req.ip,
      });
    } catch (emailError) {
      console.error('Failed to send password setup email:', emailError);
      return res.status(500).json({
        success: false,
        message: 'Failed to send email',
      });
    }
    
    res.json({
      success: true,
      message: 'Password setup email sent successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error resending setup email',
      error: error.message,
    });
  }
};

/**
 * Update user status (Admin only)
 * PATCH /api/users/:xID/status
 */
const updateUserStatus = async (req, res) => {
  try {
    const { xID } = req.params;
    const { active } = req.body;
    
    if (active === undefined) {
      return res.status(400).json({
        success: false,
        message: 'active field is required',
      });
    }
    
    // Get admin from authenticated request
    const admin = req.user;
    
    // Find user
    const user = await User.findOne({ xID: xID.toUpperCase() });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }
    
    // Update status
    user.isActive = active;
    await user.save();
    
    // Log status change
    await AuthAudit.create({
      xID: user.xID,
      actionType: active ? 'AccountActivated' : 'AccountDeactivated',
      description: `User account ${active ? 'activated' : 'deactivated'} by admin`,
      performedBy: admin.xID,
      ipAddress: req.ip,
    });
    
    res.json({
      success: true,
      message: `User ${active ? 'activated' : 'deactivated'} successfully`,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating user status',
      error: error.message,
    });
  }
};

/**
 * Unlock user account (Admin only)
 * POST /api/auth/unlock-account
 */
const unlockAccount = async (req, res) => {
  try {
    const { xID } = req.body;
    
    if (!xID) {
      return res.status(400).json({
        success: false,
        message: 'xID is required',
      });
    }
    
    // Get admin from authenticated request
    const admin = req.user;
    
    // Find user
    const user = await User.findOne({ xID: xID.toUpperCase() });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }
    
    // Unlock account
    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    await user.save();
    
    // Log unlock
    await AuthAudit.create({
      xID: user.xID,
      actionType: 'AccountUnlocked',
      description: `Account unlocked by admin`,
      performedBy: admin.xID,
      ipAddress: req.ip,
    });
    
    res.json({
      success: true,
      message: 'Account unlocked successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error unlocking account',
      error: error.message,
    });
  }
};

module.exports = {
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
};
