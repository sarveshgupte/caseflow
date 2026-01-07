/**
 * Email Service for Caseflow
 * 
 * Sends transactional emails for authentication and user management
 * Uses console logging in development (can be replaced with actual email service in production)
 */

const crypto = require('crypto');

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
 * Send password setup email
 * @param {string} email - Recipient email
 * @param {string} name - User's name
 * @param {string} token - Password setup token (plain text)
 * @param {string} frontendUrl - Base URL of frontend application
 */
const sendPasswordSetupEmail = async (email, name, token, frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000') => {
  const setupLink = `${frontendUrl}/set-password?token=${token}`;
  
  // In production, replace this with actual email service (SendGrid, AWS SES, etc.)
  console.log('\n========================================');
  console.log('📧 PASSWORD SETUP EMAIL');
  console.log('========================================');
  console.log(`To: ${email}`);
  console.log(`Name: ${name}`);
  console.log('Subject: Set your password for your Caseflow account');
  console.log('');
  console.log('Message:');
  console.log(`Hello ${name},`);
  console.log('');
  console.log('Welcome to Caseflow! An administrator has created an account for you.');
  console.log('');
  console.log('Please set your password by clicking the link below:');
  console.log(setupLink);
  console.log('');
  console.log('This link will expire in 24 hours.');
  console.log('');
  console.log('If you did not request this account, please ignore this email.');
  console.log('');
  console.log('Best regards,');
  console.log('Caseflow Team');
  console.log('========================================\n');
  
  // In production, implement actual email sending here
  // Example with SendGrid:
  // const sgMail = require('@sendgrid/mail');
  // sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  // await sgMail.send({
  //   to: email,
  //   from: process.env.EMAIL_FROM,
  //   subject: 'Set your password for your Caseflow account',
  //   html: `...`
  // });
  
  return true;
};

/**
 * Send password setup reminder email (for resend functionality)
 * @param {string} email - Recipient email
 * @param {string} name - User's name
 * @param {string} token - Password setup token (plain text)
 * @param {string} frontendUrl - Base URL of frontend application
 */
const sendPasswordSetupReminderEmail = async (email, name, token, frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000') => {
  const setupLink = `${frontendUrl}/set-password?token=${token}`;
  
  console.log('\n========================================');
  console.log('📧 PASSWORD SETUP REMINDER EMAIL');
  console.log('========================================');
  console.log(`To: ${email}`);
  console.log(`Name: ${name}`);
  console.log('Subject: Reminder: Set your password for your Caseflow account');
  console.log('');
  console.log('Message:');
  console.log(`Hello ${name},`);
  console.log('');
  console.log('This is a reminder to set your password for your Caseflow account.');
  console.log('');
  console.log('Please set your password by clicking the link below:');
  console.log(setupLink);
  console.log('');
  console.log('This link will expire in 24 hours.');
  console.log('');
  console.log('Best regards,');
  console.log('Caseflow Team');
  console.log('========================================\n');
  
  return true;
};

module.exports = {
  generateSecureToken,
  hashToken,
  sendPasswordSetupEmail,
  sendPasswordSetupReminderEmail,
};
