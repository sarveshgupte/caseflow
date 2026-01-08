const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const User = require('../models/User.model');
const UserProfile = require('../models/UserProfile.model');
const AuthAudit = require('../models/AuthAudit.model');
const emailService = require('../services/email.service');
const xIDGenerator = require('../services/xIDGenerator');

/**
 * Authentication Controller for xID-based Enterprise Authentication
 * PART B - Identity and Authentication Management
 */

const SALT_ROUNDS = 10;
const PASSWORD_EXPIRY_DAYS = 60;
const PASSWORD_HISTORY_LIMIT = 5;
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_TIME = 15 * 60 * 1000; // 15 minutes in milliseconds
const INVITE_TOKEN_EXPIRY_HOURS = 48; // 48 hours for invite tokens (per PR 32 requirements)
const PASSWORD_SETUP_TOKEN_EXPIRY_HOURS = 24; // 24 hours for password reset tokens
const FORGOT_PASSWORD_TOKEN_EXPIRY_MINUTES = 30; // 30 minutes for forgot password tokens

/**
 * Login with xID and password
 * POST /api/auth/login
 */
const login = async (req, res) => {
  try {
    // Accept both xID and XID from request payload, normalize internally
    const { xID, XID, password } = req.body;
    
    // Normalize xID: accept either xID or XID, trim whitespace, convert to uppercase
    const normalizedXID = (xID || XID)?.trim().toUpperCase();
    
    if (!normalizedXID || !password) {
      console.warn('[AUTH] Missing credentials in login attempt', {
        hasXID: !!normalizedXID,
        hasPassword: !!password,
        ip: req.ip,
      });
      
      return res.status(400).json({
        success: false,
        message: 'xID and password are required',
      });
    }
    
    // Find user by xID
    const user = await User.findOne({ xID: normalizedXID });
    
    if (!user) {
      // Log failed login attempt
      await AuthAudit.create({
        xID: normalizedXID,
        actionType: 'LoginFailed',
        description: `Login failed: User not found`,
        performedBy: normalizedXID,
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
    if (!user.passwordSet || !user.passwordHash) {
      return res.status(403).json({
        success: false,
        message: 'Please set your password using the link sent to your email',
        passwordSetupRequired: true,
      });
    }
    
    // PR 32: Check if user must change password (invite not completed)
    // Block login until password is set via invite link
    if (user.mustChangePassword) {
      return res.status(403).json({
        success: false,
        message: 'Please complete your account setup using the invite link sent to your email',
        mustChangePassword: true,
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
    
    // Check if force password reset is required (for first login)
    // This allows login to succeed but prompts for password reset
    if (user.forcePasswordReset) {
      console.log(`[AUTH] First login detected for user ${user.xID}, generating password reset token`);
      
      // Generate new secure password reset token
      const token = emailService.generateSecureToken();
      const tokenHash = emailService.hashToken(token);
      const tokenExpiry = new Date(Date.now() + PASSWORD_SETUP_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);
      
      // Construct reset URL for logging
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const resetUrl = `${frontendUrl}/reset-password?token=${token}`;
      console.log('PASSWORD RESET LINK:', resetUrl);
      
      if (!process.env.FRONTEND_URL) {
        console.warn('[AUTH] FRONTEND_URL not configured. Using default http://localhost:3000.');
      }
      
      // Update user with token
      user.passwordResetTokenHash = tokenHash;
      user.passwordResetExpires = tokenExpiry;
      
      try {
        await user.save();
      } catch (saveError) {
        console.error('[AUTH] Failed to save password reset token:', saveError.message);
      }
      
      // Send password reset email
      let emailSent = false;
      try {
        await emailService.sendPasswordResetEmail(user.email, user.name, token);
        emailSent = true;
        console.log(`[AUTH] Password reset email sent successfully`);
      } catch (emailError) {
        console.error('[AUTH] Failed to send password reset email:', emailError.message);
        // Continue even if email fails - user can still use the system
      }
      
      // Log password reset email attempt
      try {
        await AuthAudit.create({
          xID: user.xID,
          actionType: 'PasswordResetEmailSent',
          description: emailSent 
            ? 'Password reset email sent on first login' 
            : 'Password reset email failed to send on first login',
          performedBy: user.xID,
          ipAddress: req.ip,
        });
      } catch (auditError) {
        console.error('[AUTH] Failed to create audit log:', auditError.message);
      }
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
    const response = {
      success: true,
      message: user.forcePasswordReset ? 'Password reset required' : 'Login successful',
      data: {
        xID: user.xID,
        name: user.name,
        email: user.email,
        role: user.role,
        allowedCategories: user.allowedCategories,
        isActive: user.isActive,
      },
    };
    
    // Add password reset flags if needed
    if (user.forcePasswordReset) {
      response.mustChangePassword = true;
      response.forcePasswordReset = true;
    }
    
    res.json(response);
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
    
    // Send password setup email with xID
    try {
      await emailService.sendPasswordSetupEmail(user.email, user.name, token, user.xID);
      
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
 * 
 * PR 32: Returns immutable fields (xID, name, email) from User model
 * and editable personal info from UserProfile model
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
        dateOfBirth: null,
        gender: null,
        phone: null,
        address: {},
        pan: null,
        panMasked: null,
        aadhaar: null,
        aadhaarMasked: null,
        email: null,
      };
    }
    
    res.json({
      success: true,
      data: {
        // Immutable fields from User model (read-only)
        xID: user.xID,
        name: user.name,
        email: user.email, // Email from User model is immutable
        role: user.role,
        allowedCategories: user.allowedCategories,
        isActive: user.isActive,
        // Mutable fields from UserProfile model (editable)
        dateOfBirth: profile.dob || profile.dateOfBirth,
        gender: profile.gender,
        phone: profile.phone,
        address: profile.address,
        panMasked: profile.pan || profile.panMasked,
        aadhaarMasked: profile.aadhaar || profile.aadhaarMasked,
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
 * 
 * PR 32: Only allows updating personal info fields
 * Immutable fields (xID, name, email from User model) are rejected if provided
 * PAN/Aadhaar must be masked format only
 */
const updateProfile = async (req, res) => {
  try {
    const { dateOfBirth, dob, gender, phone, address, panMasked, pan, aadhaarMasked, aadhaar, 
            name, email, xID } = req.body;
    
    // PR 32: Block attempts to modify immutable fields
    if (name !== undefined || email !== undefined || xID !== undefined) {
      return res.status(400).json({
        success: false,
        message: 'Cannot modify immutable fields (name, email, xID). These fields are read-only.',
      });
    }
    
    // Get user from authenticated request
    const user = req.user;
    
    // Users can only edit their own profile
    if (req.params.xID && req.params.xID !== user.xID) {
      return res.status(403).json({
        success: false,
        message: 'You can only edit your own profile',
      });
    }
    
    // Find or create profile
    let profile = await UserProfile.findOne({ xID: user.xID });
    
    const oldProfile = profile ? { ...profile.toObject() } : {};
    
    if (!profile) {
      profile = new UserProfile({ xID: user.xID });
    }
    
    // Update only editable fields
    // Support both dob and dateOfBirth (aliases)
    if (dateOfBirth !== undefined) profile.dob = dateOfBirth;
    if (dob !== undefined) profile.dob = dob;
    if (gender !== undefined) profile.gender = gender;
    if (phone !== undefined) profile.phone = phone;
    if (address !== undefined) profile.address = address;
    
    // Handle PAN (support both pan and panMasked)
    // PR 32: Enforce masked format only (no raw PAN storage)
    if (panMasked !== undefined || pan !== undefined) {
      const panValue = panMasked !== undefined ? panMasked : pan;
      
      // Validate masked format: ABCDE1234F (10 characters, uppercase)
      if (panValue && panValue.trim()) {
        const maskedPanRegex = /^[A-Z]{5}\d{4}[A-Z]$/;
        if (!maskedPanRegex.test(panValue.toUpperCase())) {
          return res.status(400).json({
            success: false,
            message: 'Invalid PAN format. Must be in format: ABCDE1234F (masked)',
          });
        }
        profile.pan = panValue.toUpperCase();
      } else {
        profile.pan = panValue;
      }
    }
    
    // Handle Aadhaar (support both aadhaar and aadhaarMasked)
    // PR 32: Enforce masked format only (no raw Aadhaar storage)
    if (aadhaarMasked !== undefined || aadhaar !== undefined) {
      const aadhaarValue = aadhaarMasked !== undefined ? aadhaarMasked : aadhaar;
      
      // Validate masked format: XXXX-XXXX-1234 or last 4 digits only
      if (aadhaarValue && aadhaarValue.trim()) {
        // Accept formats: XXXX-XXXX-1234, XXXXXXXX1234, or just 1234 (last 4 digits)
        const maskedAadhaarRegex = /^(X{4}-X{4}-\d{4}|X{8}\d{4}|\d{4})$/;
        if (!maskedAadhaarRegex.test(aadhaarValue)) {
          return res.status(400).json({
            success: false,
            message: 'Invalid Aadhaar format. Must be masked: XXXX-XXXX-1234 or last 4 digits only',
          });
        }
        profile.aadhaar = aadhaarValue;
      } else {
        profile.aadhaar = aadhaarValue;
      }
    }
    
    await profile.save();
    
    // Log profile update with old and new values
    const changes = {};
    if (dateOfBirth !== undefined || dob !== undefined) {
      changes.dateOfBirth = { old: oldProfile.dob, new: profile.dob };
    }
    if (gender !== undefined) changes.gender = { old: oldProfile.gender, new: gender };
    if (phone !== undefined) changes.phone = { old: oldProfile.phone, new: phone };
    if (address !== undefined) changes.address = { old: oldProfile.address, new: address };
    if (panMasked !== undefined || pan !== undefined) {
      changes.panMasked = { old: oldProfile.pan, new: profile.pan };
    }
    if (aadhaarMasked !== undefined || aadhaar !== undefined) {
      changes.aadhaarMasked = { old: oldProfile.aadhaar, new: profile.aadhaar };
    }
    
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
 * 
 * PR 32 Changes:
 * - xID is now AUTO-GENERATED server-side (admin cannot provide it)
 * - Email uniqueness enforced with HTTP 409 on duplicates
 * - Invite token expiry set to 48 hours
 * - mustChangePassword set to true (enforces password setup)
 */
const createUser = async (req, res) => {
  try {
    const { name, role, allowedCategories, email } = req.body;
    
    // xID is NOT accepted from request - it will be auto-generated
    if (!name || !email) {
      return res.status(400).json({
        success: false,
        message: 'name and email are required',
      });
    }
    
    // Get admin from authenticated request
    const admin = req.user;
    
    // Check if email already exists (enforce uniqueness)
    const existingUser = await User.findOne({ 
      email: email.toLowerCase() 
    });
    
    if (existingUser) {
      // Return HTTP 409 Conflict for duplicate email (per PR requirements)
      return res.status(409).json({
        success: false,
        message: 'User with this email already exists',
      });
    }
    
    // Generate next xID automatically (server-side only)
    const xID = await xIDGenerator.generateNextXID();
    
    // Mask email for logging (show first 2 and domain only)
    const emailParts = email.split('@');
    const maskedEmail = emailParts[0].substring(0, 2) + '***@' + emailParts[1];
    console.log(`[AUTH] Auto-generated xID: ${xID} for ${maskedEmail}`);
    
    // Generate secure invite token (48-hour expiry per PR 32)
    const token = emailService.generateSecureToken();
    const tokenHash = emailService.hashToken(token);
    const tokenExpiry = new Date(Date.now() + INVITE_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);
    
    // Create user without password
    const newUser = new User({
      xID: xID, // Auto-generated, immutable
      name,
      email: email.toLowerCase(),
      role: role || 'Employee',
      allowedCategories: allowedCategories || [],
      isActive: true,
      passwordHash: null,
      passwordSet: false,
      inviteTokenHash: tokenHash, // Using alias for invite token
      inviteTokenExpiry: tokenExpiry, // 48 hours
      mustChangePassword: true, // Enforce password setup on first login
      passwordHistory: [],
    });
    
    await newUser.save();
    
    // Send invite email with xID included (per PR 32 requirements)
    try {
      await emailService.sendPasswordSetupEmail(newUser.email, newUser.name, token, newUser.xID);
      
      // Log invite email sent
      await AuthAudit.create({
        xID: newUser.xID,
        actionType: 'InviteEmailSent',
        description: `Invite email sent to ${newUser.email}`,
        performedBy: admin.xID,
        ipAddress: req.ip,
      });
    } catch (emailError) {
      console.error('Failed to send invite email:', emailError);
      // Don't fail user creation if email fails
    }
    
    // Log user creation
    await AuthAudit.create({
      xID: newUser.xID,
      actionType: 'UserCreated',
      description: `User account created by admin with auto-generated xID`,
      performedBy: admin.xID,
      ipAddress: req.ip,
      metadata: {
        createdBy: admin.xID,
        role: newUser.role,
        xID: newUser.xID,
      },
    });
    
    res.status(201).json({
      success: true,
      message: 'User created successfully. Invite email sent.',
      data: {
        xID: newUser.xID, // Return auto-generated xID
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        allowedCategories: newUser.allowedCategories,
        passwordSet: newUser.passwordSet,
      },
    });
  } catch (error) {
    // Handle duplicate email error from MongoDB
    if (error.code === 11000 && error.keyPattern && error.keyPattern.email) {
      return res.status(409).json({
        success: false,
        message: 'User with this email already exists',
      });
    }
    
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
    
    // Prevent admin from deactivating themselves
    if (admin.xID === xID.toUpperCase()) {
      return res.status(400).json({
        success: false,
        message: 'You cannot deactivate your own account',
      });
    }
    
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
 * Set password using token from email (for first-time password setup)
 * POST /api/auth/set-password
 * 
 * Used when a new user sets their password for the first time.
 * Does NOT check password history since this is initial setup.
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
 * Reset password using token from first login email (for password resets)
 * POST /api/auth/reset-password-with-token
 * 
 * Used when a user resets their password (e.g., on first login with default password).
 * DOES check password history to prevent reuse.
 * Note: Separate from setPassword to maintain different validation rules.
 */
const resetPasswordWithToken = async (req, res) => {
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
    
    // Find user with matching token hash (check both reset and setup tokens in one query)
    const user = await User.findOne({ 
      $or: [
        {
          passwordResetTokenHash: tokenHash,
          passwordResetExpires: { $gt: new Date() }
        },
        {
          passwordSetupTokenHash: tokenHash,
          passwordSetupExpires: { $gt: new Date() }
        }
      ]
    });
    
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired password reset token',
      });
    }
    
    // Check if new password matches any of the last 5 passwords
    const passwordHistory = user.passwordHistory || [];
    
    for (const oldPassword of passwordHistory.slice(-PASSWORD_HISTORY_LIMIT)) {
      const isReused = await bcrypt.compare(password, oldPassword.hash);
      if (isReused) {
        return res.status(400).json({
          success: false,
          message: 'Cannot reuse any of your last 5 passwords',
        });
      }
    }
    
    // Check if new password is same as current
    if (user.passwordHash) {
      const isSameAsCurrent = await bcrypt.compare(password, user.passwordHash);
      if (isSameAsCurrent) {
        return res.status(400).json({
          success: false,
          message: 'New password must be different from current password',
        });
      }
    }
    
    // Hash new password
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    
    // Add current password to history if it exists
    if (user.passwordHash) {
      user.passwordHistory.push({
        hash: user.passwordHash,
        changedAt: new Date(),
      });
      
      // Keep only last 5 passwords in history
      if (user.passwordHistory.length > PASSWORD_HISTORY_LIMIT) {
        user.passwordHistory = user.passwordHistory.slice(-PASSWORD_HISTORY_LIMIT);
      }
    }
    
    // Update password and clear tokens
    user.passwordHash = passwordHash;
    user.passwordSet = true;
    user.passwordResetTokenHash = null;
    user.passwordResetExpires = null;
    user.passwordSetupTokenHash = null;
    user.passwordSetupExpires = null;
    user.passwordLastChangedAt = new Date();
    user.passwordExpiresAt = new Date(Date.now() + PASSWORD_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
    user.mustChangePassword = false;
    user.forcePasswordReset = false;
    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    
    await user.save();
    
    // Log password reset
    await AuthAudit.create({
      xID: user.xID,
      actionType: 'PasswordReset',
      description: `User reset password via email link`,
      performedBy: user.xID,
      ipAddress: req.ip,
    });
    
    res.json({
      success: true,
      message: 'Password reset successfully. You can now log in with your new password.',
    });
  } catch (error) {
    console.error('[AUTH] Error resetting password:', error);
    res.status(500).json({
      success: false,
      message: 'Error resetting password',
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
    
    // Generate new secure invite token (48-hour expiry)
    const token = emailService.generateSecureToken();
    const tokenHash = emailService.hashToken(token);
    const tokenExpiry = new Date(Date.now() + INVITE_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);
    
    // Update token
    user.inviteTokenHash = tokenHash;
    user.inviteTokenExpiry = tokenExpiry;
    await user.save();
    
    // Send invite reminder email with xID
    try {
      await emailService.sendPasswordSetupReminderEmail(user.email, user.name, token, user.xID);
      
      // Log invite email sent
      await AuthAudit.create({
        xID: user.xID,
        actionType: 'InviteEmailResent',
        description: `Invite reminder email sent to ${user.email}`,
        performedBy: admin.xID,
        ipAddress: req.ip,
      });
    } catch (emailError) {
      console.error('Failed to send invite email:', emailError);
      return res.status(500).json({
        success: false,
        message: 'Failed to send email',
      });
    }
    
    res.json({
      success: true,
      message: 'Invite email sent successfully',
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
    
    // Prevent admin from deactivating themselves
    if (!active && admin.xID === xID.toUpperCase()) {
      return res.status(400).json({
        success: false,
        message: 'You cannot deactivate your own account',
      });
    }
    
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

/**
 * Forgot password - Request password reset link
 * POST /api/auth/forgot-password
 * Public endpoint - does not require authentication
 */
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required',
      });
    }
    
    // Find user by email (normalize to lowercase)
    const user = await User.findOne({ email: email.toLowerCase() });
    
    // Always return success to prevent email enumeration attacks
    // This is a security best practice - don't reveal if email exists
    if (!user) {
      // Mask email for logging
      const emailParts = email.split('@');
      const maskedEmail = emailParts[0].substring(0, 2) + '***@' + (emailParts[1] || '');
      console.log(`[AUTH] Forgot password requested for non-existent email: ${maskedEmail}`);
      
      return res.json({
        success: true,
        message: 'If an account exists with this email, you will receive a password reset link.',
      });
    }
    
    // Check if user is active
    if (!user.isActive) {
      console.log(`[AUTH] Forgot password requested for inactive user (xID: ${user.xID})`);
      
      return res.json({
        success: true,
        message: 'If an account exists with this email, you will receive a password reset link.',
      });
    }
    
    // Generate secure password reset token
    const token = emailService.generateSecureToken();
    const tokenHash = emailService.hashToken(token);
    const tokenExpiry = new Date(Date.now() + FORGOT_PASSWORD_TOKEN_EXPIRY_MINUTES * 60 * 1000);
    
    // Update user with reset token
    user.passwordResetTokenHash = tokenHash;
    user.passwordResetExpires = tokenExpiry;
    await user.save();
    
    // Send password reset email
    try {
      await emailService.sendForgotPasswordEmail(user.email, user.name, token);
      
      // Log password reset request
      await AuthAudit.create({
        xID: user.xID,
        actionType: 'ForgotPasswordRequested',
        description: `Password reset link sent to ${user.email}`,
        performedBy: user.xID,
        ipAddress: req.ip,
      });
    } catch (emailError) {
      console.error('[AUTH] Failed to send forgot password email:', emailError);
      // Continue even if email fails - we don't want to reveal if email exists
    }
    
    res.json({
      success: true,
      message: 'If an account exists with this email, you will receive a password reset link.',
    });
  } catch (error) {
    console.error('[AUTH] Error in forgot password:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing password reset request',
      error: error.message,
    });
  }
};

/**
 * Get all users (Admin only)
 * GET /api/admin/users
 */
const getAllUsers = async (req, res) => {
  try {
    // Get all users, excluding password-related fields
    const users = await User.find()
      .select('-passwordHash -passwordHistory -passwordSetupTokenHash -passwordResetTokenHash')
      .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      data: users,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching users',
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
  resetPasswordWithToken,
  resendSetupEmail,
  updateUserStatus,
  unlockAccount,
  forgotPassword,
  getAllUsers,
};
