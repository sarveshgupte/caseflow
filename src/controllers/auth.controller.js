const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { google } = require('googleapis');
const User = require('../models/User.model');
const Firm = require('../models/Firm.model');
const UserProfile = require('../models/UserProfile.model');
const AuthAudit = require('../models/AuthAudit.model');
const RefreshToken = require('../models/RefreshToken.model');
const emailService = require('../services/email.service');
const xIDGenerator = require('../services/xIDGenerator');
const jwtService = require('../services/jwt.service');
const { ensureDefaultClientForFirm } = require('../services/defaultClient.service');

/**
 * Authentication Controller for JWT-based Enterprise Authentication
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
const DEFAULT_FIRM_ID = 'PLATFORM'; // Default firmId for SUPER_ADMIN and audit logging
const DEFAULT_XID = 'SUPERADMIN'; // Default xID for SUPER_ADMIN in audit logs
const GOOGLE_SCOPES = ['openid', 'email'];
const GOOGLE_STATE_TTL_SECONDS = 10 * 60; // 10 minutes
const ROLE_SUPER_ADMIN = 'SUPER_ADMIN';
const ROLE_ADMIN = 'Admin';
const ROLE_EMPLOYEE = 'Employee';
const isSuperAdminRole = (role) => role === 'SuperAdmin' || role === ROLE_SUPER_ADMIN || role === 'SUPERADMIN';

/**
 * Google OAuth client factory (Authorization Code Flow)
 */
const getGoogleOAuthClient = () => {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_CALLBACK_URL } = process.env;
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_CALLBACK_URL) {
    throw new Error('Google OAuth is not configured');
  }

  return new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_CALLBACK_URL
  );
};

/**
 * Create signed, expiring OAuth state token for CSRF protection
 */
const createOAuthState = (payload = {}) => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured for OAuth state signing');
  }

  return jwt.sign(
    {
      nonce: crypto.randomBytes(16).toString('hex'),
      ...payload,
    },
    process.env.JWT_SECRET,
    { expiresIn: `${GOOGLE_STATE_TTL_SECONDS}s` }
  );
};

/**
 * Verify OAuth state token
 */
const verifyOAuthState = (stateToken) => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured for OAuth state verification');
  }

  return jwt.verify(stateToken, process.env.JWT_SECRET);
};

/**
 * Build tokens + audit entry for successful login
 */
const buildTokenResponse = async (user, req, authMethod = 'Password') => {
  const accessToken = jwtService.generateAccessToken({
    userId: user._id.toString(),
    firmId: user.firmId ? user.firmId.toString() : undefined,
    role: user.role,
  });

  const refreshToken = jwtService.generateRefreshToken();
  const refreshTokenHash = jwtService.hashRefreshToken(refreshToken);

  await RefreshToken.create({
    tokenHash: refreshTokenHash,
    userId: user._id,
    firmId: user.firmId || null,
    expiresAt: jwtService.getRefreshTokenExpiry(),
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });

  let firmSlug = null;
  if (user.firmId) {
    const firm = await Firm.findOne({ _id: user.firmId });
    if (firm) {
      firmSlug = firm.firmSlug;
    }
  }

  try {
    await AuthAudit.create({
      xID: user.xID || DEFAULT_XID,
      firmId: user.firmId || DEFAULT_FIRM_ID,
      userId: user._id,
      actionType: 'Login',
      description: `User logged in via ${authMethod}`,
      performedBy: user.xID,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
  } catch (auditError) {
    console.error('[AUTH AUDIT] Failed to record login event', auditError);
  }

  return { accessToken, refreshToken, firmSlug };
};

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
    
    // xID and password are required
    if (!normalizedXID || !password) {
      console.warn('[AUTH] Missing credentials in login attempt', {
        hasXID: !!(xID || XID),
        hasPassword: !!password,
        ip: req.ip,
      });
      
      return res.status(400).json({
        success: false,
        message: 'xID and password are required',
      });
    }
    
    // ============================================================
    // SUPERADMIN AUTHENTICATION (FROM .ENV - NEVER FROM MONGODB)
    // ============================================================
    // SuperAdmin credentials are ONLY in .env, never in database
    // This is the authoritative authentication path for SuperAdmin
    const superadminXID = process.env.SUPERADMIN_XID;
    
    if (normalizedXID === superadminXID) {
      console.log('[AUTH] SuperAdmin login attempt detected');
      
      // Authenticate against .env ONLY (do NOT query MongoDB)
      const superadminPassword = process.env.SUPERADMIN_PASSWORD;
      
      if (!superadminPassword) {
        console.error('[AUTH] SUPERADMIN_PASSWORD not configured in environment');
        return res.status(500).json({
          success: false,
          message: 'SuperAdmin authentication not configured',
        });
      }
      
      // Verify password (plain text comparison for SuperAdmin from .env)
      if (password !== superadminPassword) {
        console.warn('[AUTH] SuperAdmin login failed - invalid password');
        return res.status(401).json({
          success: false,
          message: 'Invalid xID or password',
        });
      }
      
      console.log('[AUTH] SuperAdmin login successful');
      
      // Generate JWT with NO firmId, NO defaultClientId
      const accessToken = jwtService.generateAccessToken({
        userId: 'SUPERADMIN', // Special identifier (not a MongoDB _id)
        role: 'SuperAdmin',
        // NO firmId
        // NO defaultClientId
      });
      
      // Generate refresh token
      const refreshToken = jwtService.generateRefreshToken();
      const refreshTokenHash = jwtService.hashRefreshToken(refreshToken);
      
      // Store refresh token (with null userId for SuperAdmin)
      await RefreshToken.create({
        tokenHash: refreshTokenHash,
        userId: null, // SuperAdmin has no MongoDB user document
        firmId: null, // SuperAdmin has no firm
        expiresAt: jwtService.getRefreshTokenExpiry(),
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });
      
      // Return successful login response
      return res.json({
        success: true,
        message: 'Login successful',
        accessToken,
        refreshToken,
        data: {
          xID: superadminXID,
          role: 'SuperAdmin',
          // NO firmId
          // NO defaultClientId
        },
      });
    }
    
    // ============================================================
    // NORMAL USER AUTHENTICATION (FROM MONGODB)
    // ============================================================
    
    // If firmSlug is provided, use firm-scoped lookup
    // This prevents ambiguity when multiple firms have the same xID (e.g., X000001)
    let user;
    
    if (req.firmId) {
      // Firm-scoped login - query by firmId AND xID
      console.log(`[AUTH] Firm-scoped login attempt: firmSlug=${req.firmSlug}, xID=${normalizedXID}`);
      user = await User.findOne({ 
        firmId: req.firmId, 
        xID: normalizedXID 
      });
    } else {
      // Legacy login without firm context - query by xID only
      // This supports existing users who don't have firmSlug yet
      console.log(`[AUTH] Legacy login attempt (no firm context): xID=${normalizedXID}`);
      user = await User.findOne({ xID: normalizedXID });
      
      // If multiple users with same xID exist, reject login
      if (user) {
        const duplicateCount = await User.countDocuments({ xID: normalizedXID });
        if (duplicateCount > 1) {
          console.warn(`[AUTH] Multiple users with xID ${normalizedXID} found. Firm-scoped login required.`);
          return res.status(400).json({
            success: false,
            message: 'Multiple accounts found. Please use your firm-specific login URL.',
          });
        }
      }
    }
    
    if (!user) {
      // Check if system has been initialized (any users exist)
      const userCount = await User.countDocuments();
      
      if (userCount === 0) {
        // System not initialized - no users exist
        console.warn('[AUTH] Login attempt but system not initialized (no users exist)');
        return res.status(503).json({
          success: false,
          message: 'System not initialized. Please contact SuperAdmin.',
        });
      }
      
      // Log failed login attempt (no firmId available as user doesn't exist)
      try {
        await AuthAudit.create({
          xID: normalizedXID || 'UNKNOWN',
          firmId: req.firmIdString || 'UNKNOWN', // Use resolved firmId if available
          actionType: 'LoginFailed',
          description: `Login failed: User not found (attempted with xID: ${normalizedXID}, firmSlug: ${req.firmSlug || 'none'})`,
          performedBy: normalizedXID,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        });
      } catch (auditError) {
        console.error('[AUTH AUDIT] Failed to record login failure event', auditError);
      }
      
      return res.status(401).json({
        success: false,
        message: 'Invalid xID or password',
      });
    }
    
    // ============================================================
    // PART 3: PREVENT ADMIN LOGIN BEFORE FIRM INITIALIZATION
    // ============================================================
    // If user is not SuperAdmin and no firms exist, block login
    // This prevents confusing "empty dashboard" behavior
    if (user.role !== 'SUPER_ADMIN') {
      const Firm = require('../models/Firm.model');
      const firmCount = await Firm.countDocuments();
      
      if (firmCount === 0) {
        console.warn(`[AUTH] Login blocked for ${user.xID} - system not initialized (no firms exist)`);
        return res.status(403).json({
          success: false,
          message: 'System not initialized. Contact SuperAdmin.',
        });
      }
    }
    
    // PR-2: Check firm bootstrap status for Admin users
    // Block login if firm bootstrap is not completed
    if (user.role === 'Admin' && user.firmId) {
      try {
        const firm = await Firm.findById(user.firmId);
        if (firm && firm.bootstrapStatus !== 'COMPLETED') {
          console.warn(`[AUTH] Login blocked for ${user.xID} - firm bootstrap not completed (status: ${firm.bootstrapStatus})`);
          return res.status(403).json({
            success: false,
            message: 'Firm setup incomplete. Please contact support.',
            bootstrapStatus: firm.bootstrapStatus,
          });
        }
      } catch (firmError) {
        console.error(`[AUTH] Error checking firm bootstrap status:`, firmError.message);
        // Continue - don't block login on lookup failure
      }
    }
    
    // Validate Admin user has required fields (firmId and defaultClientId)
    if (user.role === ROLE_ADMIN) {
      if (!user.firmId) {
        console.error(`[AUTH] Admin user ${user.xID} missing firmId - data integrity violation`);
        return res.status(500).json({
          success: false,
          message: 'Account configuration error. Please contact administrator.',
        });
      }
      
      // PR-2: Backward compatibility - Auto-assign defaultClientId if missing
      if (!user.defaultClientId) {
        console.warn(`[AUTH] Admin user ${user.xID} missing defaultClientId - attempting auto-repair`);
        
        try {
          // Find firm and get its defaultClientId
          const firm = await Firm.findById(user.firmId);
          
          if (firm && firm.defaultClientId && firm.bootstrapStatus === 'COMPLETED') {
            // Auto-assign firm's defaultClientId to admin (persist to database)
            await User.updateOne(
              { _id: user._id },
              { $set: { defaultClientId: firm.defaultClientId } }
            );
            
            // Update in-memory user object with persisted value
            user.defaultClientId = firm.defaultClientId;
            
            console.log(`[AUTH] ✓ Persisted defaultClientId for legacy admin ${user.xID}`);
            console.log(`[AUTH]   Subsequent logins will not trigger auto-repair`);
          } else {
            console.error(`[AUTH] Admin user ${user.xID} missing defaultClientId - cannot auto-repair (firm not ready)`);
            return res.status(500).json({
              success: false,
              message: 'Account configuration error. Please contact administrator.',
            });
          }
        } catch (autoRepairError) {
          console.error(`[AUTH] Failed to auto-repair defaultClientId for ${user.xID}:`, autoRepairError.message);
          return res.status(500).json({
            success: false,
            message: 'Account configuration error. Please contact administrator.',
          });
        }
      }
    }
    
    // Check if user is active
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account is deactivated',
      });
    }
    
    // Check if user status is ACTIVE (invited users cannot login)
    if (user.status && user.status !== 'ACTIVE') {
      return res.status(403).json({
        success: false,
        message: 'Please complete your account setup using the invite link sent to your email',
        accountStatus: user.status,
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
    
    // Check if password has been set (mustSetPassword is the only gate)
    if (user.mustSetPassword || !user.passwordHash) {
      return res.status(403).json({
        success: false,
        code: 'PASSWORD_SETUP_REQUIRED',
        message: 'Please set your password using the link sent to your email',
        mustSetPassword: true,
        redirectPath: '/auth/set-password',
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
        try {
          await AuthAudit.create({
            xID: user.xID,
            firmId: user.firmId || DEFAULT_FIRM_ID,
            userId: user._id,
            actionType: 'AccountLocked',
            description: `Account locked due to ${MAX_FAILED_ATTEMPTS} failed login attempts`,
            performedBy: user.xID,
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
          });
        } catch (auditError) {
          console.error('[AUTH AUDIT] Failed to record account lock event', auditError);
        }
        
        return res.status(403).json({
          success: false,
          message: 'Account locked due to too many failed login attempts. Please try again in 15 minutes or contact an administrator.',
          lockedUntil: user.lockUntil,
        });
      }
      
      await user.save();
      
      // Log failed login attempt
      try {
        await AuthAudit.create({
          xID: user.xID,
          firmId: user.firmId || DEFAULT_FIRM_ID,
          userId: user._id,
          actionType: 'LoginFailed',
          description: `Login failed: Invalid password (attempt ${user.failedLoginAttempts})`,
          performedBy: user.xID,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        });
      } catch (auditError) {
        console.error('[AUTH AUDIT] Failed to record login failure event', auditError);
      }
      
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
    
    // Check if password has expired (skip if passwordExpiresAt is null)
    const now = new Date();
    if (user.passwordExpiresAt && user.passwordExpiresAt < now) {
      // Log password expiry
      try {
        await AuthAudit.create({
          xID: user.xID,
          firmId: user.firmId || DEFAULT_FIRM_ID,
          userId: user._id,
          actionType: 'PasswordExpired',
          description: `Login attempt with expired password`,
          performedBy: user.xID,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        });
      } catch (auditError) {
        console.error('[AUTH AUDIT] Failed to record password expiry event', auditError);
      }
      
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
        const emailResult = await emailService.sendPasswordResetEmail(user.email, user.name, token);
        emailSent = emailResult.success;
        if (emailSent) {
          console.log(`[AUTH] Password reset email sent successfully`);
        } else {
          console.error(`[AUTH] Password reset email failed:`, emailResult.error);
        }
      } catch (emailError) {
        console.error('[AUTH] Failed to send password reset email:', emailError.message);
        // Continue even if email fails - user can still use the system
      }
      
      // Log password reset email attempt
      try {
        await AuthAudit.create({
          xID: user.xID,
          firmId: user.firmId || DEFAULT_FIRM_ID,
          userId: user._id,
          actionType: 'PasswordResetEmailSent',
          description: emailSent 
            ? 'Password reset email sent on first login' 
            : 'Password reset email failed to send on first login',
          performedBy: user.xID,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        });
      } catch (auditError) {
        console.error('[AUTH AUDIT] Failed to record password reset email event', auditError);
      }
    }
    
    // Log successful login (non-blocking)
    try {
      await AuthAudit.create({
        xID: user.xID || DEFAULT_XID,
        firmId: user.firmId || DEFAULT_FIRM_ID,
        userId: user._id,
        actionType: 'Login',
        description: `User logged in successfully`,
        performedBy: user.xID,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });
    } catch (auditError) {
      console.error('[AUTH AUDIT] Failed to record login event', auditError);
    }
    
    // Generate JWT access token
    const accessToken = jwtService.generateAccessToken({
      userId: user._id.toString(),
      firmId: user.firmId ? user.firmId.toString() : undefined,
      role: user.role,
    });
    
    // Generate refresh token
    const refreshToken = jwtService.generateRefreshToken();
    const refreshTokenHash = jwtService.hashRefreshToken(refreshToken);
    
    // Store refresh token in database
    await RefreshToken.create({
      tokenHash: refreshTokenHash,
      userId: user._id,
      firmId: user.firmId || null,
      expiresAt: jwtService.getRefreshTokenExpiry(),
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    
    // Fetch firmSlug for firm-scoped routing
    let firmSlug = null;
    if (user.firmId) {
      const firm = await Firm.findOne({ _id: user.firmId });
      if (firm) {
        firmSlug = firm.firmSlug;
      }
    }
    
    // Return user info with tokens (exclude sensitive fields)
    const response = {
      success: true,
      message: user.forcePasswordReset ? 'Password reset required' : 'Login successful',
      accessToken,
      refreshToken,
      data: {
        id: user._id.toString(),
        xID: user.xID,
        name: user.name,
        email: user.email,
        role: user.role,
        firmId: user.firmId ? user.firmId.toString() : null,
        firmSlug: firmSlug,
        allowedCategories: user.allowedCategories,
        isActive: user.isActive,
        mustSetPassword: !!user.mustSetPassword,
        passwordSetAt: user.passwordSetAt,
      },
    };
    
    // Add password reset flags if needed
    if (user.forcePasswordReset) {
      response.mustChangePassword = true;
      response.forcePasswordReset = true;
    }
    
    res.json(response);
  } catch (error) {
    console.error('[AUTH] Login error:', error);
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
    // Get user from authenticated request
    const user = req.user;
    const userId = user?._id;
    const isSuperAdmin = isSuperAdminRole(user?.role);
    const isValidUserId = mongoose.Types.ObjectId.isValid(userId);
    const shouldBypassUserDbUpdates = isSuperAdmin || !isValidUserId;
    
    // SUPERADMIN and other non-ObjectId principals don't have User documents
    // Skip any userId-based DB writes to avoid CastError on logout
    if (!shouldBypassUserDbUpdates) {
      // Revoke all refresh tokens for this user
      await RefreshToken.updateMany(
        { userId: user._id, isRevoked: false },
        { isRevoked: true }
      );
    }

    const secureCookies = process.env.NODE_ENV === 'production';
    res.clearCookie('accessToken', { httpOnly: true, secure: secureCookies, sameSite: 'lax', path: '/' });
    res.clearCookie('refreshToken', { httpOnly: true, secure: secureCookies, sameSite: 'lax', path: '/' });
    
    // Log logout (non-blocking)
    try {
      if (!shouldBypassUserDbUpdates) {
        await AuthAudit.create({
          xID: user.xID,
          firmId: user.firmId || DEFAULT_FIRM_ID,
          userId: user._id,
          actionType: 'Logout',
          description: `User logged out`,
          performedBy: user.xID,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        });
      }
    } catch (auditError) {
      console.error('[AUTH AUDIT] Failed to record logout event', auditError);
    }
    
    res.json({
      success: true,
      message: 'Logout successful',
    });
  } catch (error) {
    console.error('[AUTH] Logout error:', error);
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

    // Onboarding guard: changePassword is for onboarded users only
    // DO NOT gate on passwordSet; mustSetPassword is authoritative.
    if (user.mustSetPassword) {
      return res.status(403).json({
        success: false,
        code: 'PASSWORD_SETUP_REQUIRED',
        mustSetPassword: true,
        redirectPath: '/auth/set-password',
      });
    }
    
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
    user.passwordExpiresAt = new Date(Date.now() + PASSWORD_EXPIRY_DAYS * 24 * 60 * 60 * 1000); // Update expiry on password change
    user.mustChangePassword = false;
    user.mustSetPassword = false; // Keep onboarding flag aligned after a successful rotation
    user.passwordSetAt = new Date();
    
    await user.save();
    
    // Revoke all refresh tokens for security (force re-login)
    await RefreshToken.updateMany(
      { userId: user._id, isRevoked: false },
      { isRevoked: true }
    );
    
    // Log password change
    await AuthAudit.create({
      xID: user.xID,
      firmId: user.firmId,
      userId: user._id,
      actionType: 'PasswordChanged',
      description: `User changed their password`,
      performedBy: user.xID,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    
    res.json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error) {
    console.error('[AUTH] Change password error:', error);
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
    
    // Reset password state (put user back into invite-like state)
    user.passwordHash = null;
    user.passwordSet = false;
    user.passwordSetupTokenHash = tokenHash;
    user.passwordSetupExpires = tokenExpiry;
    user.mustChangePassword = false;
    user.mustSetPassword = true;
    user.passwordExpiresAt = null; // Clear expiry until password is set
    user.status = 'INVITED'; // User must set password to become active again
    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    user.passwordSetAt = null;
    
    await user.save();
    
    // Fetch firmSlug for email
    let firmSlug = null;
    if (user.firmId) {
      const firm = await Firm.findById(user.firmId);
      if (firm) {
        firmSlug = firm.firmSlug;
      }
    }
    
    // Send password setup email with xID
    try {
      const emailResult = await emailService.sendPasswordSetupEmail({
        email: user.email,
        name: user.name,
        token: token,
        xID: user.xID,
        firmSlug: firmSlug // Pass firmSlug for firm-specific URL in email
      });
      
      // Log password setup email sent
      await AuthAudit.create({
        xID: user.xID,
        firmId: user.firmId,
        userId: user._id,
        actionType: 'PasswordSetupEmailSent',
        description: emailResult.success 
          ? `Password reset email sent to ${emailService.maskEmail(user.email)}` 
          : `Password reset email failed to send to ${emailService.maskEmail(user.email)}: ${emailResult.error}`,
        performedBy: admin.xID,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });
    } catch (emailError) {
      console.error('[AUTH] Failed to send password setup email:', emailError.message);
      // Continue even if email fails
    }
    
    // Log password reset
    await AuthAudit.create({
      xID: user.xID,
      firmId: user.firmId,
      userId: user._id,
      actionType: 'PasswordResetByAdmin',
      description: `Password reset by admin - setup email sent`,
      performedBy: admin.xID,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
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
    
    // Populate firm metadata for display
    await user.populate('firmId', 'firmId name');
    
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
        id: user._id.toString(),
        // Immutable fields from User model (read-only)
        xID: user.xID,
        name: user.name,
        email: user.email, // Email from User model is immutable
        role: user.role,
        mustSetPassword: !!user.mustSetPassword,
        passwordSetAt: user.passwordSetAt,
        allowedCategories: user.allowedCategories,
        isActive: user.isActive,
        // Firm metadata (read-only, admin-controlled)
        firm: user.firmId ? {
          id: user.firmId._id.toString(),
          firmId: user.firmId.firmId,
          name: user.firmId.name,
        } : null,
        firmId: user.firmId ? user.firmId._id.toString() : null,
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
            name, email, xID, firmId } = req.body;
    
    // PR 32: Block attempts to modify immutable fields
    if (name !== undefined || email !== undefined || xID !== undefined || firmId !== undefined) {
      return res.status(400).json({
        success: false,
        message: 'Cannot modify immutable fields (name, email, xID, firmId). These fields are read-only.',
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
      firmId: user.firmId,
      userId: user._id,
      actionType: 'ProfileUpdated',
      description: `User profile updated`,
      performedBy: user.xID,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
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
    
    // Prevent creation of SUPER_ADMIN users
    if (role === 'SUPER_ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Cannot create Superadmin users',
      });
    }
    
    // xID is NOT accepted from request - it will be auto-generated
    if (!name || !email) {
      return res.status(400).json({
        success: false,
        message: 'name and email are required',
      });
    }
    
    // Get admin from authenticated request
    const admin = req.user;
    
    // Resolve firm's default client to inherit for new user
    const firm = await Firm.findById(admin.firmId);
    if (!firm) {
      return res.status(404).json({
        success: false,
        message: 'Firm not found',
      });
    }

    // Auto-create default client if missing (defensive backfill)
    if (!firm.defaultClientId) {
      await ensureDefaultClientForFirm(firm);
    }

    if (!firm.defaultClientId) {
      console.error('[AUTH] Firm default client not configured for admin firm', admin.firmId);
      return res.status(500).json({
        success: false,
        message: 'Firm default client not configured',
      });
    }
    
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
    const xID = await xIDGenerator.generateNextXID(admin.firmId);
    
    // Mask email for logging (show first 2 and domain only)
    const emailParts = email.split('@');
    const maskedEmail = emailParts[0].substring(0, 2) + '***@' + emailParts[1];
    console.log(`[AUTH] Auto-generated xID: ${xID} for ${maskedEmail}`);
    
    // Generate secure invite token (48-hour expiry per PR 32)
    const token = emailService.generateSecureToken();
    const tokenHash = emailService.hashToken(token);
    const tokenExpiry = new Date(Date.now() + INVITE_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);
    
    // Create user without password (invite-based onboarding)
    const newUser = new User({
      xID: xID, // Auto-generated, immutable
      name,
      email: email.toLowerCase(),
      firmId: admin.firmId, // Inherit firmId from admin
      defaultClientId: firm.defaultClientId,
      role: role || 'Employee',
      allowedCategories: allowedCategories || [],
      isActive: true,
      passwordHash: null, // No password until user sets it
      passwordSet: false, // Password not set yet
      mustSetPassword: true,
      inviteTokenHash: tokenHash, // Using alias for invite token
      inviteTokenExpiry: tokenExpiry, // 48 hours
      mustChangePassword: true, // Enforce password setup on first login
      passwordExpiresAt: null, // Not set until password is created
      status: 'INVITED', // User is invited, not yet active
      passwordHistory: [],
      passwordSetAt: null,
    });
    
    await newUser.save();
    console.log(`[AUTH] User inherited defaultClientId from firm ${firm._id}`);
    
    // Fetch firmSlug for email
    const firmSlug = firm.firmSlug;
    
    // Send invite email with xID included (per PR 32 requirements)
    try {
      const emailResult = await emailService.sendPasswordSetupEmail({
        email: newUser.email,
        name: newUser.name,
        token: token,
        xID: newUser.xID,
        firmSlug: firmSlug // Pass firmSlug for firm-specific URL in email
      });
      
      // Log invite email sent
      await AuthAudit.create({
        xID: newUser.xID,
        firmId: newUser.firmId,
        userId: newUser._id,
        actionType: 'InviteEmailSent',
        description: emailResult.success 
          ? `Invite email sent to ${emailService.maskEmail(newUser.email)}` 
          : `Invite email failed to send to ${emailService.maskEmail(newUser.email)}: ${emailResult.error}`,
        performedBy: admin.xID,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });
    } catch (emailError) {
      console.error('[AUTH] Failed to send invite email:', emailError.message);
      // Don't fail user creation if email fails - log and continue
      try {
        await AuthAudit.create({
          xID: newUser.xID,
          firmId: newUser.firmId,
          userId: newUser._id,
          actionType: 'InviteEmailFailed',
          description: `Failed to send invite email to ${emailService.maskEmail(newUser.email)}: ${emailError.message}`,
          performedBy: admin.xID,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        });
      } catch (auditError) {
        console.error('[AUTH] Failed to log email error:', auditError.message);
      }
    }
    
    // Log user creation
    await AuthAudit.create({
      xID: newUser.xID,
      firmId: newUser.firmId,
      userId: newUser._id,
      actionType: 'UserCreated',
      description: `User account created by admin with auto-generated xID`,
      performedBy: admin.xID,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
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
    // Handle duplicate key errors from MongoDB (E11000)
    if (error.code === 11000) {
      // Check which field caused the duplicate
      if (error.keyPattern && error.keyPattern.email) {
        console.error('[AUTH] Duplicate email error:', error.message);
        return res.status(409).json({
          success: false,
          message: 'User with this email already exists',
        });
      }
      
      if (error.keyPattern && error.keyPattern.xID) {
        // This should never happen with atomic counter operations
        // If this occurs, it indicates a critical system issue
        console.error('[AUTH] CRITICAL: Duplicate xID error (identity collision):', error.message);
        console.error('[AUTH] Counter value:', error.keyValue?.xID);
        console.error('[AUTH] This should be investigated immediately');
        return res.status(500).json({
          success: false,
          message: 'Identity generation collision. Please try again or contact support.',
        });
      }
      
      // Generic duplicate key error
      console.error('[AUTH] Duplicate key error:', error.message);
      return res.status(409).json({
        success: false,
        message: 'A user with this information already exists',
      });
    }
    
    // Log all other errors for debugging
    console.error('[AUTH] Error creating user:', error);
    
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
      firmId: user.firmId,
      userId: user._id,
      actionType: 'AccountActivated',
      description: `User account activated by admin`,
      performedBy: admin.xID,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
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
    
    // PROTECTION: Prevent deactivation of system users (default admin)
    if (user.isSystem === true) {
      // Log the attempt for audit
      await AuthAudit.create({
        xID: user.xID,
        firmId: user.firmId,
        userId: user._id,
        actionType: 'DeactivationAttemptBlocked',
        description: `Attempted to deactivate system user (default admin) - blocked`,
        performedBy: admin.xID,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });
      
      return res.status(403).json({
        success: false,
        message: 'Cannot deactivate the default admin user. This is a protected system entity.',
      });
    }
    
    // Deactivate user
    user.isActive = false;
    await user.save();
    
    // Log deactivation
    await AuthAudit.create({
      xID: user.xID,
      firmId: user.firmId,
      userId: user._id,
      actionType: 'AccountDeactivated',
      description: `User account deactivated by admin`,
      performedBy: admin.xID,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
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
    user.mustSetPassword = false;
    user.passwordSetupTokenHash = null;
    user.passwordSetupExpires = null;
    user.passwordLastChangedAt = new Date();
    user.passwordSetAt = new Date();
    user.passwordExpiresAt = new Date(Date.now() + PASSWORD_EXPIRY_DAYS * 24 * 60 * 60 * 1000); // Set expiry when password is created
    user.mustChangePassword = false;
    user.status = 'ACTIVE'; // User becomes active after setting password
    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    
    await user.save();
    
    // Log password setup
    await AuthAudit.create({
      xID: user.xID,
      firmId: user.firmId,
      userId: user._id,
      actionType: 'PasswordSetup',
      description: `User set password via email link`,
      performedBy: user.xID,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    
    // Fetch firmSlug for firm-scoped redirect
    let firmSlug = null;
    if (user.firmId) {
      const firm = await Firm.findOne({ _id: user.firmId });
      if (firm) {
        firmSlug = firm.firmSlug;
      }
    }
    
    // Fail fast if firmSlug cannot be resolved
    if (!firmSlug) {
      return res.status(400).json({
        success: false,
        message: 'Firm context missing. Cannot complete password setup. Please contact support.',
      });
    }
    
    res.json({
      success: true,
      message: 'Password set successfully. You can now log in.',
      firmSlug: firmSlug,
      redirectUrl: `/f/${firmSlug}/login`,
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
    user.mustSetPassword = false;
    user.passwordResetTokenHash = null;
    user.passwordResetExpires = null;
    user.passwordSetupTokenHash = null;
    user.passwordSetupExpires = null;
    user.passwordLastChangedAt = new Date();
    user.passwordSetAt = new Date();
    user.passwordExpiresAt = new Date(Date.now() + PASSWORD_EXPIRY_DAYS * 24 * 60 * 60 * 1000); // Set expiry when password is reset
    user.mustChangePassword = false;
    user.forcePasswordReset = false;
    user.status = 'ACTIVE'; // Ensure user is active after password reset
    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    
    await user.save();
    
    // Log password reset
    await AuthAudit.create({
      xID: user.xID,
      firmId: user.firmId,
      userId: user._id,
      actionType: 'PasswordReset',
      description: `User reset password via email link`,
      performedBy: user.xID,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
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
 * 
 * @deprecated This function is deprecated as of PR #48
 * Use POST /api/admin/users/:xID/resend-invite instead (admin.controller.js)
 * This endpoint has been removed from auth.routes.js to prevent password enforcement issues
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
    
    // Fetch firmSlug for email
    let firmSlug = null;
    if (user.firmId) {
      const firm = await Firm.findById(user.firmId);
      if (firm) {
        firmSlug = firm.firmSlug;
      }
    }
    
    // Send invite reminder email with xID
    try {
      const emailResult = await emailService.sendPasswordSetupReminderEmail({
        email: user.email,
        name: user.name,
        token: token,
        xID: user.xID,
        firmSlug: firmSlug // Pass firmSlug for firm-specific URL in email
      });
      
      if (!emailResult.success) {
        console.error('[AUTH] Failed to send invite reminder email:', emailResult.error);
        return res.status(500).json({
          success: false,
          message: 'Failed to send email',
          error: emailResult.error,
        });
      }
      
      // Log invite email sent
      await AuthAudit.create({
        xID: user.xID,
        firmId: user.firmId,
        userId: user._id,
        actionType: 'InviteEmailResent',
        description: `Invite reminder email sent to ${emailService.maskEmail(user.email)}`,
        performedBy: admin.xID,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });
    } catch (emailError) {
      console.error('[AUTH] Failed to send invite email:', emailError.message);
      return res.status(500).json({
        success: false,
        message: 'Failed to send email',
        error: emailError.message,
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
    
    // PROTECTION: Prevent deactivation of system users (default admin)
    if (user.isSystem === true && !active) {
      // Log the attempt for audit
      await AuthAudit.create({
        xID: user.xID,
        firmId: user.firmId,
        userId: user._id,
        actionType: 'DeactivationAttemptBlocked',
        description: `Attempted to deactivate system user (default admin) - blocked`,
        performedBy: admin.xID,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });
      
      return res.status(403).json({
        success: false,
        message: 'Cannot deactivate the default admin user. This is a protected system entity.',
      });
    }
    
    // Update status
    user.isActive = active;
    await user.save();
    
    // Log status change
    await AuthAudit.create({
      xID: user.xID,
      firmId: user.firmId,
      userId: user._id,
      actionType: active ? 'AccountActivated' : 'AccountDeactivated',
      description: `User account ${active ? 'activated' : 'deactivated'} by admin`,
      performedBy: admin.xID,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
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
      firmId: user.firmId,
      userId: user._id,
      actionType: 'AccountUnlocked',
      description: `Account unlocked by admin`,
      performedBy: admin.xID,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
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
      const emailResult = await emailService.sendForgotPasswordEmail(user.email, user.name, token);
      
      // Log password reset request
      await AuthAudit.create({
        xID: user.xID,
        firmId: user.firmId,
        userId: user._id,
        actionType: 'ForgotPasswordRequested',
        description: emailResult.success 
          ? `Password reset link sent to ${emailService.maskEmail(user.email)}` 
          : `Password reset link failed to send to ${emailService.maskEmail(user.email)}: ${emailResult.error}`,
        performedBy: user.xID,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });
    } catch (emailError) {
      console.error('[AUTH] Failed to send forgot password email:', emailError.message);
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
    // Get requesting admin's firmId for same-firm filtering
    const adminFirmId = req.user.firmId;
    
    // Get all users in same firm, excluding password-related fields
    // Populate firm metadata for display
    const users = await User.find({ firmId: adminFirmId })
      .select('-passwordHash -passwordHistory -passwordSetupTokenHash -passwordResetTokenHash')
      .populate('firmId', 'firmId name')
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

/**
 * Refresh access token using refresh token
 * POST /api/auth/refresh
 */
const refreshAccessToken = async (req, res) => {
  try {
    const refreshToken =
      req.body.refreshToken ||
      (req.headers.cookie ? req.headers.cookie.split(';').map(c => c.trim().split('=')).find(([k]) => k === 'refreshToken')?.[1] : null);
    
    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token is required',
      });
    }
    
    // Hash the provided refresh token
    const tokenHash = jwtService.hashRefreshToken(refreshToken);
    
    // Find the refresh token in database
    const storedToken = await RefreshToken.findOne({
      tokenHash,
      isRevoked: false,
      expiresAt: { $gt: new Date() },
    });
    
    if (!storedToken) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired refresh token',
      });
    }
    
    // Get the user
    const user = await User.findById(storedToken.userId);
    
    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'User not found or inactive',
      });
    }
    
    // Revoke the old refresh token (token rotation)
    storedToken.isRevoked = true;
    await storedToken.save();
    
    // Generate new access token
    const newAccessToken = jwtService.generateAccessToken({
      userId: user._id.toString(),
      firmId: user.firmId,
      role: user.role,
    });
    
    // Generate new refresh token
    const newRefreshToken = jwtService.generateRefreshToken();
    const newTokenHash = jwtService.hashRefreshToken(newRefreshToken);
    
    // Store new refresh token
    await RefreshToken.create({
      tokenHash: newTokenHash,
      userId: user._id,
      firmId: user.firmId,
      expiresAt: jwtService.getRefreshTokenExpiry(),
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    const secureCookies = process.env.NODE_ENV === 'production';
    const fifteenMinutesMs = 15 * 60 * 1000;
    const refreshMs = (jwtService.REFRESH_TOKEN_EXPIRY_DAYS || 7) * 24 * 60 * 60 * 1000;

    res.cookie('accessToken', newAccessToken, {
      httpOnly: true,
      secure: secureCookies,
      sameSite: 'lax',
      maxAge: fifteenMinutesMs,
      path: '/',
    });

    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: secureCookies,
      sameSite: 'lax',
      maxAge: refreshMs,
      path: '/',
    });
    
    // Log token refresh
    await AuthAudit.create({
      xID: user.xID,
      firmId: user.firmId,
      userId: user._id,
      actionType: 'TokenRefreshed',
      description: 'Access token refreshed successfully',
      performedBy: user.xID,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    
    res.json({
      success: true,
      message: 'Token refreshed successfully',
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });
  } catch (error) {
    console.error('[AUTH] Refresh token error:', error);
    res.status(500).json({
      success: false,
      message: 'Error refreshing token',
      error: error.message,
    });
  }
};

/**
 * Initiate Google OAuth (invite-only, DB-backed users only)
 * GET /api/auth/google
 */
const initiateGoogleAuth = (req, res) => {
  try {
    const oauthClient = getGoogleOAuthClient();
    const { firmSlug, flow } = req.query;

    if (!firmSlug && flow !== 'activation') {
      return res.status(403).json({
        success: false,
        message: 'Google login not allowed',
      });
    }

    const state = createOAuthState({
      firmSlug: firmSlug || null,
      flow: flow || 'login',
    });

    const authUrl = oauthClient.generateAuthUrl({
      prompt: 'select_account',
      scope: GOOGLE_SCOPES,
      state,
    });

    return res.redirect(authUrl);
  } catch (error) {
    console.error('[AUTH] Google OAuth initiation failed:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Google OAuth is not configured. Please use password login.',
    });
  }
};

/**
 * Google OAuth callback (Authorization Code flow)
 * GET /api/auth/google/callback
 */
const handleGoogleCallback = async (req, res) => {
  try {
    const { code, state } = req.query;

    if (!code || !state) {
      return res.status(400).json({
        success: false,
        message: 'Missing authorization code or state',
      });
    }

    let statePayload;
    let flow = 'login';
    let firmSlugFromState = null;
    try {
      statePayload = verifyOAuthState(state);
      flow = statePayload?.flow || 'login';
      firmSlugFromState = statePayload?.firmSlug || null;
    } catch (stateError) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired OAuth state',
      });
    }

    const oauthClient = getGoogleOAuthClient();
    const { tokens } = await oauthClient.getToken(code);

    if (!tokens?.id_token) {
      return res.status(400).json({
        success: false,
        message: 'Failed to exchange authorization code',
      });
    }

    const ticket = await oauthClient.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload() || {};
    const email = payload.email ? payload.email.toLowerCase() : null;
    const googleId = payload.sub;
    const emailVerified = payload.email_verified !== false; // treat undefined as true

    if (!email || !googleId || !emailVerified) {
      return res.status(403).json({
        success: false,
        message: 'Google account not eligible for login',
      });
    }

    // Resolution step 1: existing linked Google account
    let user = await User.findOne({ 'authProviders.google.googleId': googleId });
    let linkedDuringRequest = false;

    // Resolution step 2: match by email (invite-only, role limited)
    if (!user) {
      const candidate = await User.findOne({ email });
      const isActivation = flow === 'activation';
      if (
        candidate &&
        [ROLE_ADMIN, ROLE_EMPLOYEE].includes(candidate.role) &&
        candidate.isActive !== false &&
        candidate.status !== 'DISABLED'
      ) {
        if (!isActivation && candidate.status !== 'ACTIVE') {
          return res.status(403).json({
            success: false,
            message: 'Account is not activated. Use your invite link to activate with Google.',
          });
        }
        candidate.authProviders = candidate.authProviders || {};
        candidate.authProviders.google = candidate.authProviders.google || {};
        candidate.authProviders.google.googleId = googleId;
        candidate.authProviders.google.linkedAt = new Date();
        if (isActivation && candidate.status !== 'ACTIVE') {
          candidate.status = 'ACTIVE';
        }
        candidate.mustChangePassword = false;
        candidate.forcePasswordReset = false;
        await candidate.save();
        user = candidate;
        linkedDuringRequest = true;
      }
    }

    // Resolution step 3: reject external users
    if (!user) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Account is not invited.',
      });
    }

    // Guardrails: SuperAdmin cannot use Google auth
    if (user.role === ROLE_SUPER_ADMIN || user.xID === process.env.SUPERADMIN_XID) {
      return res.status(403).json({
        success: false,
        message: 'SuperAdmin accounts must use password login',
      });
    }

    // Account state checks
    if (!user.isActive || user.status === 'DISABLED') {
      return res.status(403).json({
        success: false,
        message: 'Account is not active. Contact your administrator.',
      });
    }

    if (user.status && user.status !== 'ACTIVE') {
      return res.status(403).json({
        success: false,
        message: 'Please activate your account before using Google login.',
      });
    }

    if (user.isLocked) {
      return res.status(403).json({
        success: false,
        message: 'Account is locked. Please try again later or contact an administrator.',
        lockedUntil: user.lockUntil,
      });
    }

    // Admin firm bootstrapping + default client guardrails
    if (user.role === 'Admin') {
      if (!user.firmId) {
        return res.status(500).json({
          success: false,
          message: 'Account configuration error. Please contact administrator.',
        });
      }

      try {
        const firm = await Firm.findById(user.firmId);
        if (firm && firm.bootstrapStatus !== 'COMPLETED') {
          return res.status(403).json({
            success: false,
            message: 'Firm setup incomplete. Please contact support.',
            bootstrapStatus: firm.bootstrapStatus,
          });
        }

        if (!user.defaultClientId) {
          if (firm && firm.defaultClientId && firm.bootstrapStatus === 'COMPLETED') {
            await User.updateOne(
              { _id: user._id },
              { $set: { defaultClientId: firm.defaultClientId } }
            );
            user.defaultClientId = firm.defaultClientId;
          } else {
            return res.status(500).json({
              success: false,
              message: 'Account configuration error. Please contact administrator.',
            });
          }
        }
      } catch (firmError) {
        console.error('[AUTH] Error validating admin firm for Google login:', firmError.message);
        return res.status(500).json({
          success: false,
          message: 'Account configuration error. Please contact administrator.',
        });
      }
    }

    // Build tokens + audit
    const { accessToken, refreshToken, firmSlug: resolvedSlug } = await buildTokenResponse(
      user,
      req,
      linkedDuringRequest ? 'GoogleOAuthLink' : 'GoogleOAuth'
    );

    const frontendBase = process.env.FRONTEND_URL || 'http://localhost:3000';
    const redirectUrl = new URL('/google-callback', frontendBase);

    const finalFirmSlug = firmSlugFromState || resolvedSlug || null;
    if (finalFirmSlug) {
      redirectUrl.searchParams.set('firmSlug', finalFirmSlug);
    }

    const secureCookies = process.env.NODE_ENV === 'production';
    const fifteenMinutesMs = 15 * 60 * 1000;
    const refreshMs = (jwtService.REFRESH_TOKEN_EXPIRY_DAYS || 7) * 24 * 60 * 60 * 1000;

    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: secureCookies,
      sameSite: 'lax',
      maxAge: fifteenMinutesMs,
      path: '/',
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: secureCookies,
      sameSite: 'lax',
      maxAge: refreshMs,
      path: '/',
    });

    return res.redirect(redirectUrl.toString());
  } catch (error) {
    console.error('[AUTH] Google OAuth callback error:', error);
    return res.status(500).json({
      success: false,
      message: 'Google login failed',
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
  // resendSetupEmail - REMOVED: Deprecated in PR #48, use admin.controller.resendInviteEmail instead
  updateUserStatus,
  unlockAccount,
  forgotPassword,
  getAllUsers,
  refreshAccessToken, // NEW: JWT token refresh
  initiateGoogleAuth,
  handleGoogleCallback,
};
