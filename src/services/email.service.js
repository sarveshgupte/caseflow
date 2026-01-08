/**
 * Email Service for Docketra
 * 
 * Sends transactional emails for authentication and user management
 * Uses SMTP in production when configured, falls back to console logging in development
 */

const crypto = require('crypto');
const nodemailer = require('nodemailer');

// Initialize SMTP transporter if SMTP is configured
let transporter = null;
const isSmtpConfigured = process.env.SMTP_HOST && process.env.SMTP_PORT;

if (isSmtpConfigured) {
  try {
    const transportConfig = {
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT, 10),
      secure: parseInt(process.env.SMTP_PORT, 10) === 465, // true for 465, false for other ports
    };
    
    // Only add auth if credentials are provided
    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      transportConfig.auth = {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      };
    }
    
    transporter = nodemailer.createTransport(transportConfig);
    console.log('[EMAIL] SMTP transport initialized successfully');
  } catch (error) {
    console.error('[EMAIL] Failed to initialize SMTP transport:', error.message);
    transporter = null;
  }
}

/**
 * Send email via SMTP or log to console
 * @param {Object} mailOptions - Email options (to, subject, html, text)
 * @returns {Promise<boolean>} Success status
 */
const sendEmail = async (mailOptions) => {
  const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER || `noreply@${process.env.SMTP_HOST || 'localhost'}`;
  
  if (transporter) {
    // Send via SMTP
    try {
      await transporter.sendMail({
        from: fromAddress,
        ...mailOptions,
      });
      console.log(`[EMAIL] Email sent successfully to ${mailOptions.to}`);
      return true;
    } catch (error) {
      console.error(`[EMAIL] Failed to send email: ${error.message}`);
      return false;
    }
  } else {
    // Fallback to console logging (development mode)
    console.log('\n========================================');
    console.log('📧 EMAIL (Console Mode - Development)');
    console.log('========================================');
    console.log(`To: ${mailOptions.to}`);
    console.log(`Subject: ${mailOptions.subject}`);
    console.log('');
    console.log('Note: SMTP not configured. Email logged to console only.');
    console.log('Configure SMTP_HOST and SMTP_PORT to enable email delivery.');
    console.log('Optionally configure SMTP_USER and SMTP_PASS for authenticated SMTP.');
    console.log('========================================\n');
    return true;
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
 * @param {string} email - Recipient email
 * @param {string} name - User's name
 * @param {string} token - Password setup token (plain text)
 * @param {string} xID - User's xID (for reference)
 * @param {string} frontendUrl - Base URL of frontend application
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
 * @param {string} email - Recipient email
 * @param {string} name - User's name
 * @param {string} token - Password setup token (plain text)
 * @param {string} xID - User's xID (for reference)
 * @param {string} frontendUrl - Base URL of frontend application
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
 * @param {string} email - Recipient email
 * @param {string} name - User's name
 * @param {string} token - Password reset token (plain text)
 * @param {string} frontendUrl - Base URL of frontend application
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
 * @param {string} email - Recipient email
 * @param {string} name - User's name
 * @param {string} token - Password reset token (plain text)
 * @param {string} frontendUrl - Base URL of frontend application
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

module.exports = {
  generateSecureToken,
  hashToken,
  sendPasswordSetupEmail,
  sendPasswordSetupReminderEmail,
  sendPasswordResetEmail,
  sendForgotPasswordEmail,
};
