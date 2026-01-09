const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { requireAdmin } = require('../middleware/permission.middleware');
const { sendTestEmail } = require('../services/email.service');

/**
 * Debug Routes
 * PR #43 - Debug and testing endpoints
 * All routes require authentication and admin role
 */

// Simple in-memory rate limiter for debug endpoint
// Maps xID -> { count, resetTime }
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 5; // 5 requests per minute per admin

/**
 * Rate limiting middleware for debug endpoints
 * Prevents abuse while allowing legitimate testing
 * Applied before authentication to prevent DB access on rate-limited requests
 */
const debugRateLimit = (req, res, next) => {
  // For unauthenticated requests, use IP-based rate limiting
  // For authenticated requests, use xID-based rate limiting
  const identifier = req.user?.xID || req.ip || 'anonymous';
  const now = Date.now();
  
  let rateLimitData = rateLimitMap.get(identifier);
  
  // Reset if window expired
  if (!rateLimitData || now > rateLimitData.resetTime) {
    rateLimitData = {
      count: 0,
      resetTime: now + RATE_LIMIT_WINDOW_MS,
    };
    rateLimitMap.set(identifier, rateLimitData);
  }
  
  // Check limit
  if (rateLimitData.count >= RATE_LIMIT_MAX_REQUESTS) {
    return res.status(429).json({
      success: false,
      message: 'Rate limit exceeded. Please try again in a minute.',
      resetTime: new Date(rateLimitData.resetTime).toISOString(),
    });
  }
  
  // Increment count
  rateLimitData.count++;
  next();
};

/**
 * Send test email
 * GET /api/debug/email-test
 * 
 * Sends a test email to verify SMTP configuration
 * Admin-only endpoint for debugging and validation
 * Rate limited to 5 requests per minute (applied before auth to prevent DB abuse)
 */
router.get('/email-test', debugRateLimit, authenticate, requireAdmin, async (req, res) => {
  try {
    // Use authenticated user's email or query parameter
    const testEmail = req.query.email || req.user.email;
    
    if (!testEmail) {
      return res.status(400).json({
        success: false,
        message: 'Email address is required. Provide ?email=your@email.com',
      });
    }
    
    console.log(`[DEBUG] Sending test email to ${testEmail} (requested by ${req.user.xID})`);
    
    // Send test email
    const result = await sendTestEmail(testEmail);
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Test email sent successfully',
        recipient: testEmail,
        messageId: result.messageId,
        timestamp: new Date().toISOString(),
        smtpConfig: {
          host: process.env.SMTP_HOST || 'Not configured',
          port: process.env.SMTP_PORT || 'Not configured',
          user: process.env.SMTP_USER ? 'Configured' : 'Not configured',
          from: process.env.SMTP_FROM || process.env.SMTP_USER || 'Not configured',
        },
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to send test email',
        error: result.error,
        recipient: testEmail,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.error('[DEBUG] Error sending test email:', error);
    res.status(500).json({
      success: false,
      message: 'Error sending test email',
      error: error.message,
    });
  }
});

module.exports = router;
