/**
 * Email Service for Docketra
 * 
 * Sends transactional emails for authentication and user management
 * Uses Brevo Transactional Email API in production, console logging in development
 * 
 * Environment detection: process.env.NODE_ENV === 'production'
 */

const crypto = require('crypto');
const https = require('https');

// Detect production mode
const isProduction = process.env.NODE_ENV === 'production';

// Constants
const BREVO_MESSAGE_ID_FALLBACK = 'brevo-email-sent';

/**
 * Parse MAIL_FROM format "Name <email@domain>" into structured sender object
 * @param {string} mailFrom - Email in format "Name <email@domain>" or just "email@domain"
 * @returns {Object} { name, email }
 * @throws {Error} If format is invalid
 */
const parseSender = (mailFrom) => {
  if (!mailFrom || typeof mailFrom !== 'string') {
    throw new Error('MAIL_FROM must be a valid string');
  }
  
  const trimmed = mailFrom.trim();
  
  // Format: "Name <email@domain>"
  const match = trimmed.match(/^(.+?)\s*<([^>]+)>$/);
  
  if (match) {
    const name = match[1].trim().replace(/^["']|["']$/g, ''); // Remove quotes if present
    const email = match[2].trim();
    
    // Validate email format
    if (!email.includes('@')) {
      throw new Error(`Invalid email format in MAIL_FROM: "${email}"`);
    }
    
    return { name, email };
  }
  
  // Format: just "email@domain"
  if (trimmed.includes('@')) {
    return {
      name: process.env.APP_NAME || 'Docketra',
      email: trimmed
    };
  }
  
  throw new Error(`Invalid MAIL_FROM format: "${mailFrom}". Expected "Name <email@domain>" or "email@domain"`);
};

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

/**
 * Send email via Brevo Transactional Email API
 * @param {Object} options - Email options { to, subject, html, text }
 * @returns {Promise<Object>} Result object with success status and messageId
 */
const sendTransactionalEmail = async ({ to, subject, html, text }) => {
  const apiKey = process.env.BREVO_API_KEY;
  const mailFrom = process.env.MAIL_FROM || process.env.SMTP_FROM;
  
  if (!apiKey) {
    throw new Error('BREVO_API_KEY is not configured');
  }
  
  if (!mailFrom) {
    throw new Error('MAIL_FROM or SMTP_FROM is not configured');
  }
  
  // Parse sender from MAIL_FROM format
  const sender = parseSender(mailFrom);
  
  console.log(`[EMAIL] Using sender: ${sender.name} <${sender.email}>`);
  console.log(`[EMAIL] Sending email via Brevo API`);
  
  const payload = JSON.stringify({
    sender: {
      name: sender.name,
      email: sender.email
    },
    to: [{ email: to }],
    subject: subject,
    htmlContent: html,
    textContent: text
  });
  
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.brevo.com',
      port: 443,
      path: '/v3/smtp/email',
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const response = JSON.parse(data);
            resolve({ success: true, messageId: response.messageId });
          } catch (e) {
            resolve({ success: true, messageId: BREVO_MESSAGE_ID_FALLBACK });
          }
        } else {
          reject(new Error(`Brevo API error: ${res.statusCode} - ${data}`));
        }
      });
    });
    
    req.on('error', (error) => {
      reject(new Error(`Failed to send email via Brevo: ${error.message}`));
    });
    
    req.write(payload);
    req.end();
  });
};

/**
 * Send email via Brevo API or log to console
 * Production: Use Brevo Transactional Email API
 * Development: Log to console only
 * @param {Object} mailOptions - Email options (to, subject, html, text)
 * @returns {Promise<Object>} Result object with success status and messageId
 */
const { enqueueAfterCommit } = require('./sideEffectQueue.service');
const { allow, recordFailure, recordSuccess } = require('./circuitBreaker.service');

const sendEmail = async (mailOptions, req = null) => {
  const maskedEmail = maskEmail(mailOptions.to);

  const execute = async () => {
    if (!allow('smtp')) {
      throw new Error('SMTP_CIRCUIT_OPEN');
    }

    if (isProduction) {
      try {
        console.log(`[EMAIL] Sending email via Brevo API to ${maskedEmail}`);
        const result = await sendTransactionalEmail({
          to: mailOptions.to,
          subject: mailOptions.subject,
          html: mailOptions.html,
          text: mailOptions.text
        });
        recordSuccess('smtp');
        console.log(`[EMAIL] Email sent successfully via Brevo: ${result.messageId || 'sent'}`);
        return result;
      } catch (error) {
        recordFailure('smtp');
        console.error(`[EMAIL] Failed to send email via Brevo: ${error.message}`);
        throw new Error('Failed to send email. Please check server logs for details.');
      }
    } else {
      console.log('\n========================================');
      console.log('📧 EMAIL (Development Mode - Console Only)');
      console.log('========================================');
      console.log(`To: ${maskedEmail}`);
      console.log(`Subject: ${mailOptions.subject}`);
      console.log('');
      console.log('Note: Development mode active. Emails are logged to console only.');
      console.log('Set NODE_ENV=production and configure Brevo API to enable email delivery.');
      console.log('========================================\n');
      recordSuccess('smtp');
      return { success: true, console: true };
    }
  };

  enqueueAfterCommit(req, {
    type: 'SEND_EMAIL',
    payload: { to: maskedEmail, subject: mailOptions.subject },
    execute,
    maxRetries: 3,
  });

  return { success: true, queued: true };
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
 * @param {Object} options - Email options
 * @param {string} options.email - Recipient email
 * @param {string} options.name - User's name
 * @param {string} options.token - Password setup token (plain text)
 * @param {string} options.xID - User's xID (for reference)
 * @param {string} [options.firmSlug] - Firm slug for firm-specific URL (optional)
 * @param {string} [options.frontendUrl] - Base URL of frontend application
 * @returns {Promise<Object>} Result object with success status
 */
const sendPasswordSetupEmail = async ({ 
  email, 
  name, 
  token, 
  xID, 
  firmSlug = null, 
  frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000',
  req = null,
}) => {
  const setupLink = `${frontendUrl}/set-password?token=${token}`;
  
  // Construct firm-specific login URL if firmSlug is provided
  const firmLoginUrl = firmSlug ? `${frontendUrl}/f/${firmSlug}/login` : null;
  
  const subject = 'Set up your Docketra Admin Account';
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Hello ${name},</h2>
      <p>Your firm account has been created successfully.</p>
      <p><strong>Your Employee ID (xID):</strong> ${xID}</p>
      <p>Please set your password using the link below:</p>
      <p style="margin: 20px 0;">
        <a href="${setupLink}" style="background-color: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">Set Up Your Password</a>
      </p>
      <p style="color: #666; font-size: 14px;">Or copy this link: ${setupLink}</p>
      ${firmLoginUrl ? `
      <div style="margin: 20px 0; padding: 15px; background-color: #f0f9ff; border-left: 4px solid #2196F3; border-radius: 4px;">
        <p style="margin: 0 0 10px 0; font-weight: bold; color: #1976D2;">Your Firm Login URL:</p>
        <p style="margin: 0; word-break: break-all;">
          <a href="${firmLoginUrl}" style="color: #2196F3; text-decoration: none;">${firmLoginUrl}</a>
        </p>
        <p style="margin: 10px 0 0 0; font-size: 14px; color: #666;">
          After setting your password, you will be redirected directly to your firm's login area.
        </p>
      </div>
      ` : ''}
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

Your firm account has been created successfully.

Your Employee ID (xID): ${xID}

Please set your password using the link below:
${setupLink}

${firmLoginUrl ? `Your Firm Login URL:
${firmLoginUrl}

After setting your password, you will be redirected directly to your firm's login area.

` : ''}⚠️ This link will expire in 48 hours for security reasons.

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
  }, req);
};

/**
 * Send password setup reminder email (for resend functionality)
 * @param {Object} options - Email options
 * @param {string} options.email - Recipient email
 * @param {string} options.name - User's name
 * @param {string} options.token - Password setup token (plain text)
 * @param {string} options.xID - User's xID (for reference)
 * @param {string} [options.firmSlug] - Firm slug for firm-specific URL (optional)
 * @param {string} [options.frontendUrl] - Base URL of frontend application
 * @returns {Promise<Object>} Result object with success status
 */
const sendPasswordSetupReminderEmail = async ({ 
  email, 
  name, 
  token, 
  xID, 
  firmSlug = null, 
  frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000',
  req = null,
}) => {
  const setupLink = `${frontendUrl}/set-password?token=${token}`;
  
  // Construct firm-specific login URL if firmSlug is provided
  const firmLoginUrl = firmSlug ? `${frontendUrl}/f/${firmSlug}/login` : null;
  
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
      ${firmLoginUrl ? `
      <div style="margin: 20px 0; padding: 15px; background-color: #f0f9ff; border-left: 4px solid #2196F3; border-radius: 4px;">
        <p style="margin: 0 0 10px 0; font-weight: bold; color: #1976D2;">Your Firm Login URL:</p>
        <p style="margin: 0; word-break: break-all;">
          <a href="${firmLoginUrl}" style="color: #2196F3; text-decoration: none;">${firmLoginUrl}</a>
        </p>
      </div>
      ` : ''}
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

${firmLoginUrl ? `Your Firm Login URL:
${firmLoginUrl}

` : ''}⚠️ This link will expire in 48 hours.

Best regards,
Docketra Team
  `.trim();
  
  return await sendEmail({
    to: email,
    subject,
    html: htmlContent,
    text: textContent,
  }, req);
};

/**
 * Send password reset email (for first login flow)
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
 * @param {string} email - Recipient email
 * @returns {Promise<Object>} Result object with success status
 */
const sendTestEmail = async (email) => {
  const isProduction = process.env.NODE_ENV === 'production';
  const subject = 'Docketra Email Service Test';
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Email Configuration Test</h2>
      <p>This is a test email from your Docketra application.</p>
      <p>If you received this email, your email service is working correctly!</p>
      <p><strong>Configuration Details:</strong></p>
      <ul>
        <li>Service: ${isProduction ? 'Brevo Transactional Email API' : 'Console (Development Mode)'}</li>
        <li>API Key: ${process.env.BREVO_API_KEY ? 'Configured' : 'Not configured'}</li>
        <li>From Address: ${process.env.MAIL_FROM || process.env.SMTP_FROM || 'Not configured'}</li>
      </ul>
      <p>Timestamp: ${new Date().toISOString()}</p>
      <p>Best regards,<br>Docketra Team</p>
    </div>
  `;
  
  const textContent = `
Email Configuration Test

This is a test email from your Docketra application.
If you received this email, your email service is working correctly!

Configuration Details:
- Service: ${isProduction ? 'Brevo Transactional Email API' : 'Console (Development Mode)'}
- API Key: ${process.env.BREVO_API_KEY ? 'Configured' : 'Not configured'}
- From Address: ${process.env.MAIL_FROM || process.env.SMTP_FROM || 'Not configured'}

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

// ============================================================
// TIER-1 EMAILS (CRITICAL LIFECYCLE EVENTS)
// ============================================================
// These emails are sent ONLY for firm provisioning and system integrity
// Rate-limited to prevent email budget exhaustion (300/day Brevo limit)

// In-memory rate limiting guard
const sentEmailKeys = new Set();

/**
 * Send email once per key (rate limiting)
 * @param {string} key - Unique identifier for this email event
 * @param {Function} fn - Function that sends the email
 * @returns {Promise<Object>} Result object
 */
const sendOnce = async (key, fn) => {
  if (sentEmailKeys.has(key)) {
    console.log(`[EMAIL] Rate limit: Email key "${key}" already sent in this session`);
    return { success: true, rateLimited: true };
  }
  sentEmailKeys.add(key);
  return await fn();
};

/**
 * Send Firm Created SUCCESS email to SuperAdmin
 * Tier-1: Sent once per firm
 * @param {string} superadminEmail - SuperAdmin email
 * @param {Object} data - Firm creation data
 * @returns {Promise<Object>} Result object
 */
const sendFirmCreatedEmail = async (superadminEmail, data) => {
  const key = `firm-created-${data.firmId}`;
  return await sendOnce(key, async () => {
    const subject = `Firm Created: ${data.firmName}`;
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>✅ Firm Created Successfully</h2>
        <p>A new firm has been provisioned in the Docketra system.</p>
        <p><strong>Firm Details:</strong></p>
        <ul>
          <li><strong>Firm ID:</strong> ${data.firmId}</li>
          <li><strong>Firm Name:</strong> ${data.firmName}</li>
          <li><strong>Default Client ID:</strong> ${data.defaultClientId}</li>
        </ul>
        <p><strong>Default Admin:</strong></p>
        <ul>
          <li><strong>Admin xID:</strong> ${data.adminXID}</li>
          <li><strong>Admin Email:</strong> ${maskEmail(data.adminEmail)}</li>
          <li><strong>Status:</strong> Invite email sent</li>
        </ul>
        <p>The firm is now operational. The admin will receive credentials via email.</p>
        <p>Timestamp: ${new Date().toISOString()}</p>
        <p>Best regards,<br>Docketra Platform</p>
      </div>
    `;
    
    const textContent = `
✅ Firm Created Successfully

A new firm has been provisioned in the Docketra system.

Firm Details:
- Firm ID: ${data.firmId}
- Firm Name: ${data.firmName}
- Default Client ID: ${data.defaultClientId}

Default Admin:
- Admin xID: ${data.adminXID}
- Admin Email: ${maskEmail(data.adminEmail)}
- Status: Invite email sent

The firm is now operational. The admin will receive credentials via email.

Timestamp: ${new Date().toISOString()}

Best regards,
Docketra Platform
    `.trim();
    
    return await sendEmail({
      to: superadminEmail,
      subject,
      html: htmlContent,
      text: textContent,
    });
  });
};

/**
 * Send Firm Creation FAILED email to SuperAdmin
 * Tier-1: Sent once per failure
 * @param {string} superadminEmail - SuperAdmin email
 * @param {Object} data - Failure data
 * @returns {Promise<Object>} Result object
 */
const sendFirmCreationFailedEmail = async (superadminEmail, data) => {
  const key = `firm-failed-${data.firmName}-${Date.now()}`;
  return await sendOnce(key, async () => {
    const subject = `🚨 Firm Provisioning Failed`;
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #d32f2f;">🚨 Firm Provisioning Failed</h2>
        <p>An error occurred while creating a new firm.</p>
        <p><strong>Attempted Firm Name:</strong> ${data.firmName}</p>
        <p><strong>Failure Step:</strong> ${data.failureStep}</p>
        <p><strong>Error Message:</strong></p>
        <pre style="background-color: #f5f5f5; padding: 10px; border-radius: 4px;">${data.errorMessage}</pre>
        <p>The transaction was rolled back. No partial data was created.</p>
        <p><strong>Action Required:</strong> Investigate the error and retry firm creation.</p>
        <p>Timestamp: ${new Date().toISOString()}</p>
        <p>Best regards,<br>Docketra Platform</p>
      </div>
    `;
    
    const textContent = `
🚨 Firm Provisioning Failed

An error occurred while creating a new firm.

Attempted Firm Name: ${data.firmName}
Failure Step: ${data.failureStep}
Error Message: ${data.errorMessage}

The transaction was rolled back. No partial data was created.

Action Required: Investigate the error and retry firm creation.

Timestamp: ${new Date().toISOString()}

Best regards,
Docketra Platform
    `.trim();
    
    return await sendEmail({
      to: superadminEmail,
      subject,
      html: htmlContent,
      text: textContent,
    });
  });
};

/**
 * Send System Integrity Violation email to SuperAdmin
 * Tier-1: Sent once per process start if violations exist
 * @param {string} superadminEmail - SuperAdmin email
 * @param {Object} violations - Integrity violations
 * @returns {Promise<Object>} Result object
 */
const sendSystemIntegrityEmail = async (superadminEmail, violations) => {
  const key = `integrity-${process.pid}`;
  return await sendOnce(key, async () => {
    const subject = `⚠️ System Integrity Warning`;
    
    let violationsHtml = '';
    let violationsText = '';
    
    if (violations.firmsWithoutDefaultClient && violations.firmsWithoutDefaultClient.length > 0) {
      violationsHtml += `<p><strong>Firms without defaultClientId (${violations.firmsWithoutDefaultClient.length}):</strong></p><ul>`;
      violationsText += `\nFirms without defaultClientId (${violations.firmsWithoutDefaultClient.length}):\n`;
      violations.firmsWithoutDefaultClient.forEach(firm => {
        violationsHtml += `<li>${firm.firmId} - ${firm.name}</li>`;
        violationsText += `  - ${firm.firmId} - ${firm.name}\n`;
      });
      violationsHtml += `</ul>`;
    }
    
    if (violations.clientsWithoutFirm && violations.clientsWithoutFirm.length > 0) {
      violationsHtml += `<p><strong>Clients without firmId (${violations.clientsWithoutFirm.length}):</strong></p><ul>`;
      violationsText += `\nClients without firmId (${violations.clientsWithoutFirm.length}):\n`;
      violations.clientsWithoutFirm.forEach(client => {
        violationsHtml += `<li>${client.clientId} - ${client.businessName}</li>`;
        violationsText += `  - ${client.clientId} - ${client.businessName}\n`;
      });
      violationsHtml += `</ul>`;
    }
    
    if (violations.adminsWithoutFirmOrClient && violations.adminsWithoutFirmOrClient.length > 0) {
      violationsHtml += `<p><strong>Admins without firmId/defaultClientId (${violations.adminsWithoutFirmOrClient.length}):</strong></p><ul>`;
      violationsText += `\nAdmins without firmId/defaultClientId (${violations.adminsWithoutFirmOrClient.length}):\n`;
      violations.adminsWithoutFirmOrClient.forEach(admin => {
        violationsHtml += `<li>${admin.xID} - ${admin.name} (missing: ${admin.missing.join(', ')})</li>`;
        violationsText += `  - ${admin.xID} - ${admin.name} (missing: ${admin.missing.join(', ')})\n`;
      });
      violationsHtml += `</ul>`;
    }
    
    if (violations.superAdminsMissingContext && violations.superAdminsMissingContext.length > 0) {
      violationsHtml += `<p><strong>SUPER_ADMIN accounts missing firm/defaultClient (allowed) (${violations.superAdminsMissingContext.length}):</strong></p><ul>`;
      violationsText += `\nSUPER_ADMIN accounts missing firm/defaultClient (allowed) (${violations.superAdminsMissingContext.length}):\n`;
      violations.superAdminsMissingContext.forEach(sa => {
        violationsHtml += `<li>${sa.xID} - ${sa.name} (missing: ${sa.missing.join(', ')})</li>`;
        violationsText += `  - ${sa.xID} - ${sa.name} (missing: ${sa.missing.join(', ')})\n`;
      });
      violationsHtml += `</ul>`;
    }
    
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #ff9800;">⚠️ System Integrity Warning</h2>
        <p>Data integrity violations detected on system startup:</p>
        ${violationsHtml}
        <p><strong>Impact:</strong> These violations may cause operational issues.</p>
        <p><strong>Action Required:</strong> Run data migration to fix hierarchy.</p>
        <p>The system is still operational but may exhibit unexpected behavior.</p>
        <p>Timestamp: ${new Date().toISOString()}</p>
        <p>Best regards,<br>Docketra Platform</p>
      </div>
    `;
    
    const textContent = `
⚠️ System Integrity Warning

Data integrity violations detected on system startup:
${violationsText}

Impact: These violations may cause operational issues.
Action Required: Run data migration to fix hierarchy.

The system is still operational but may exhibit unexpected behavior.

Timestamp: ${new Date().toISOString()}

Best regards,
Docketra Platform
    `.trim();
    
    return await sendEmail({
      to: superadminEmail,
      subject,
      html: htmlContent,
      text: textContent,
    });
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
  maskEmail,
  parseSender,
  // Tier-1 emails
  sendFirmCreatedEmail,
  sendFirmCreationFailedEmail,
  sendSystemIntegrityEmail,
};
