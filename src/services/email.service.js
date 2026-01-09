/**
 * Email Service for Docketra
 * 
 * Sends transactional emails for authentication and user management
 * Uses SMTP in production when configured, falls back to console logging in development
 * 
 * PR #43: Hardened Gmail SMTP configuration with startup verification
 */

const crypto = require('crypto');
const nodemailer = require('nodemailer');

/**
 * Mask email address for secure logging
 * Example: user@example.com -> us***@example.com
 */
const maskEmail = (email) => {
  if (!email || typeof email !== 'string') return 'unknown';
  
  const parts = email.split('@');
  if (parts.length !== 2) return 'invalid-email';
  
  const localPart = parts[0];
  const domain = parts[1];
  
  // Show first 2 characters, mask the rest
  const masked = localPart.length > 2 
    ? localPart.substring(0, 2) + '***' 
    : '***';
  
  return `${masked}@${domain}`;
};

// Centralized SMTP transporter (single instance)
let transporter = null;
let smtpVerified = false;

/**
 * Initialize SMTP transport with explicit Gmail configuration
 * PR #43: Hardened configuration for Gmail with App Passwords
 */
const initializeTransport = () => {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  
  // Check if SMTP is configured
  if (!host || !port) {
    console.log('[SMTP] SMTP not configured. Emails will be logged to console only.');
    console.log('[SMTP] To enable email delivery, configure SMTP_HOST and SMTP_PORT.');
    return null;
  }
  
  try {
    // PR #43: Explicit Gmail SMTP configuration
    const transportConfig = {
      host,
      port: parseInt(port, 10),
      secure: false, // PR #43: Required for Gmail port 587 (STARTTLS)
    };
    
    // Add authentication if credentials provided
    if (user && pass) {
      transportConfig.auth = {
        user,
        pass,
      };
    }
    
    const transport = nodemailer.createTransport(transportConfig);
    console.log('[SMTP] Transport initialized with configuration:', {
      host: host,
      port: port,
      secure: false,
      auth: user ? 'configured' : 'not configured',
    });
    
    return transport;
  } catch (error) {
    console.error('[SMTP] Failed to initialize transport:', error.message);
    return null;
  }
};

/**
 * Verify SMTP connection on startup
 * PR #43: Explicit startup verification with clear logging
 */
const verifySmtpConnection = async () => {
  if (!transporter) {
    return false;
  }
  
  try {
    await transporter.verify();
    console.log('[SMTP] Gmail SMTP ready');
    smtpVerified = true;
    return true;
  } catch (error) {
    console.error('[SMTP] Verification failed:', error.message);
    console.error('[SMTP] Full error:', error);
    smtpVerified = false;
    return false;
  }
};

// Initialize transport
transporter = initializeTransport();

/**
 * Send email via SMTP or log to console
 * PR #43: Enhanced with structured logging and email masking
 * @param {Object} mailOptions - Email options (to, subject, html, text)
 * @returns {Promise<Object>} Result object with success status and messageId
 */
const sendEmail = async (mailOptions) => {
  const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER || `noreply@${process.env.SMTP_HOST || 'localhost'}`;
  const maskedEmail = maskEmail(mailOptions.to);
  
  if (transporter && smtpVerified) {
    // Send via SMTP
    try {
      console.log(`[EMAIL] Attempting invite send to ${maskedEmail}`);
      
      const info = await transporter.sendMail({
        from: fromAddress,
        ...mailOptions,
      });
      
      console.log(`[EMAIL] Invite email sent: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error(`[EMAIL] Invite email failed: ${error.message}`);
      console.error(`[EMAIL] Full error:`, error);
      return { success: false, error: error.message };
    }
  } else if (transporter && !smtpVerified) {
    // SMTP configured but not verified - try anyway but log warning
    console.warn(`[EMAIL] SMTP not verified, attempting send to ${maskedEmail}`);
    try {
      const info = await transporter.sendMail({
        from: fromAddress,
        ...mailOptions,
      });
      
      console.log(`[EMAIL] Invite email sent: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error(`[EMAIL] Invite email failed: ${error.message}`);
      console.error(`[EMAIL] Full error:`, error);
      return { success: false, error: error.message };
    }
  } else {
    // Fallback to console logging (development mode)
    console.log('\n========================================');
    console.log('📧 EMAIL (Console Mode - Development)');
    console.log('========================================');
    console.log(`To: ${maskedEmail}`);
    console.log(`Subject: ${mailOptions.subject}`);
    console.log('');
    console.log('Note: SMTP not configured. Email logged to console only.');
    console.log('Configure SMTP_HOST and SMTP_PORT to enable email delivery.');
    console.log('Optionally configure SMTP_USER and SMTP_PASS for authenticated SMTP.');
    console.log('========================================\n');
    return { success: true, console: true };
  }
};

/**
 * Generate a cryptographically secure random token
 * @returns {string} Random token (32 bytes as hex string)
 */
const generateSecureToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Hash a token for secure storage
 * @param {string} token - Plain text token
 * @returns {string} Hashed token
 */
const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

/**
 * Send password setup email (Invite email for new users)
 * PR #43: Enhanced error handling and logging
 * @param {string} email - Recipient email
 * @param {string} name - User's name
 * @param {string} token - Password setup token (plain text)
 * @param {string} xID - User's xID (for reference)
 * @param {string} frontendUrl - Base URL of frontend application
 * @returns {Promise<Object>} Result object with success status
 */
const sendPasswordSetupEmail = async (email, name, token, xID, frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000') => {
  const setupLink = `${frontendUrl}/set-password?token=${token}`;
  
  const subject = 'Welcome to Docketra - Set up your account';
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Hello ${name},</h2>
      <p>Welcome to Docketra! An administrator has created an account for you.</p>
      <p><strong>Your Employee ID (xID):</strong> ${xID}</p>
      <p>Please set up your account by clicking the secure link below:</p>
      <p style="margin: 20px 0;">
        <a href="${setupLink}" style="background-color: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">Set Up Your Account</a>
      </p>
      <p style="color: #666; font-size: 14px;">Or copy this link: ${setupLink}</p>
      <p style="color: #d32f2f;">⚠️ This link will expire in 48 hours for security reasons.</p>
      <h3>For your security:</h3>
      <ul>
        <li>Keep your xID and password confidential</li>
        <li>Do not share this link with anyone</li>
        <li>Use a strong, unique password</li>
      </ul>
      <p>If you did not expect this invitation, please contact your administrator.</p>
      <p>Best regards,<br>Docketra Team</p>
    </div>
  `;
  
  const textContent = `
Hello ${name},

Welcome to Docketra! An administrator has created an account for you.

Your Employee ID (xID): ${xID}

Please set up your account by clicking the secure link below:
${setupLink}

⚠️ This link will expire in 48 hours for security reasons.

For your security:
- Keep your xID and password confidential
- Do not share this link with anyone
- Use a strong, unique password

If you did not expect this invitation, please contact your administrator.

Best regards,
Docketra Team
  `.trim();
  
  return await sendEmail({
    to: email,
    subject,
    html: htmlContent,
    text: textContent,
  });
};

/**
 * Send password setup reminder email (for resend functionality)
 * PR #43: Enhanced error handling and logging
 * @param {string} email - Recipient email
 * @param {string} name - User's name
 * @param {string} token - Password setup token (plain text)
 * @param {string} xID - User's xID (for reference)
 * @param {string} frontendUrl - Base URL of frontend application
 * @returns {Promise<Object>} Result object with success status
 */
const sendPasswordSetupReminderEmail = async (email, name, token, xID, frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000') => {
  const setupLink = `${frontendUrl}/set-password?token=${token}`;
  
  const subject = 'Reminder: Set up your Docketra account';
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Hello ${name},</h2>
      <p>This is a reminder to set up your Docketra account.</p>
      <p><strong>Your Employee ID (xID):</strong> ${xID}</p>
      <p>Please complete your account setup by clicking the link below:</p>
      <p style="margin: 20px 0;">
        <a href="${setupLink}" style="background-color: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">Set Up Your Account</a>
      </p>
      <p style="color: #666; font-size: 14px;">Or copy this link: ${setupLink}</p>
      <p style="color: #d32f2f;">⚠️ This link will expire in 48 hours.</p>
      <p>Best regards,<br>Docketra Team</p>
    </div>
  `;
  
  const textContent = `
Hello ${name},

This is a reminder to set up your Docketra account.

Your Employee ID (xID): ${xID}

Please complete your account setup by clicking the link below:
${setupLink}

⚠️ This link will expire in 48 hours.

Best regards,
Docketra Team
  `.trim();
  
  return await sendEmail({
    to: email,
    subject,
    html: htmlContent,
    text: textContent,
  });
};

/**
 * Send password reset email (for first login flow)
 * PR #43: Enhanced error handling and logging
 * @param {string} email - Recipient email
 * @param {string} name - User's name
 * @param {string} token - Password reset token (plain text)
 * @param {string} frontendUrl - Base URL of frontend application
 * @returns {Promise<Object>} Result object with success status
 */
const sendPasswordResetEmail = async (email, name, token, frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000') => {
  const resetLink = `${frontendUrl}/reset-password?token=${token}`;
  
  const subject = 'Password Reset Required for your Docketra account';
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Hello ${name},</h2>
      <p>You have successfully logged in to your Docketra account.</p>
      <p>For security reasons, you are required to reset your password.</p>
      <p>Please reset your password by clicking the link below:</p>
      <p style="margin: 20px 0;">
        <a href="${resetLink}" style="background-color: #2196F3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">Reset Password</a>
      </p>
      <p style="color: #666; font-size: 14px;">Or copy this link: ${resetLink}</p>
      <p style="color: #d32f2f;">This link will expire in 24 hours.</p>
      <p>If you did not attempt to log in, please contact your administrator immediately.</p>
      <p>Best regards,<br>Docketra Team</p>
    </div>
  `;
  
  const textContent = `
Hello ${name},

You have successfully logged in to your Docketra account.
For security reasons, you are required to reset your password.

Please reset your password by clicking the link below:
${resetLink}

This link will expire in 24 hours.

If you did not attempt to log in, please contact your administrator immediately.

Best regards,
Docketra Team
  `.trim();
  
  return await sendEmail({
    to: email,
    subject,
    html: htmlContent,
    text: textContent,
  });
};

/**
 * Send forgot password email
 * PR #43: Enhanced error handling and logging
 * @param {string} email - Recipient email
 * @param {string} name - User's name
 * @param {string} token - Password reset token (plain text)
 * @param {string} frontendUrl - Base URL of frontend application
 * @returns {Promise<Object>} Result object with success status
 */
const sendForgotPasswordEmail = async (email, name, token, frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000') => {
  const resetLink = `${frontendUrl}/reset-password?token=${token}`;
  
  const subject = 'Reset your Docketra password';
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Hello ${name},</h2>
      <p>We received a request to reset your password for your Docketra account.</p>
      <p>Please reset your password by clicking the link below:</p>
      <p style="margin: 20px 0;">
        <a href="${resetLink}" style="background-color: #2196F3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">Reset Password</a>
      </p>
      <p style="color: #666; font-size: 14px;">Or copy this link: ${resetLink}</p>
      <p style="color: #d32f2f;">This link will expire in 30 minutes for security reasons.</p>
      <p>If you did not request a password reset, please ignore this email and your password will remain unchanged.</p>
      <p>Best regards,<br>Docketra Team</p>
    </div>
  `;
  
  const textContent = `
Hello ${name},

We received a request to reset your password for your Docketra account.

Please reset your password by clicking the link below:
${resetLink}

This link will expire in 30 minutes for security reasons.

If you did not request a password reset, please ignore this email and your password will remain unchanged.

Best regards,
Docketra Team
  `.trim();
  
  return await sendEmail({
    to: email,
    subject,
    html: htmlContent,
    text: textContent,
  });
};

/**
 * Send test email (for debugging and validation)
 * PR #43: Admin-only test email functionality
 * @param {string} email - Recipient email
 * @returns {Promise<Object>} Result object with success status
 */
const sendTestEmail = async (email) => {
  const subject = 'Docketra SMTP Test Email';
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>SMTP Configuration Test</h2>
      <p>This is a test email from your Docketra application.</p>
      <p>If you received this email, your SMTP configuration is working correctly!</p>
      <p><strong>Configuration Details:</strong></p>
      <ul>
        <li>SMTP Host: ${process.env.SMTP_HOST || 'Not configured'}</li>
        <li>SMTP Port: ${process.env.SMTP_PORT || 'Not configured'}</li>
        <li>SMTP User: ${process.env.SMTP_USER ? 'Configured' : 'Not configured'}</li>
        <li>From Address: ${process.env.SMTP_FROM || process.env.SMTP_USER || 'Not configured'}</li>
      </ul>
      <p>Timestamp: ${new Date().toISOString()}</p>
      <p>Best regards,<br>Docketra Team</p>
    </div>
  `;
  
  const textContent = `
SMTP Configuration Test

This is a test email from your Docketra application.
If you received this email, your SMTP configuration is working correctly!

Configuration Details:
- SMTP Host: ${process.env.SMTP_HOST || 'Not configured'}
- SMTP Port: ${process.env.SMTP_PORT || 'Not configured'}
- SMTP User: ${process.env.SMTP_USER ? 'Configured' : 'Not configured'}
- From Address: ${process.env.SMTP_FROM || process.env.SMTP_USER || 'Not configured'}

Timestamp: ${new Date().toISOString()}

Best regards,
Docketra Team
  `.trim();
  
  return await sendEmail({
    to: email,
    subject,
    html: htmlContent,
    text: textContent,
  });
};

module.exports = {
  generateSecureToken,
  hashToken,
  sendPasswordSetupEmail,
  sendPasswordSetupReminderEmail,
  sendPasswordResetEmail,
  sendForgotPasswordEmail,
  sendTestEmail,
  verifySmtpConnection,
  maskEmail,
};
