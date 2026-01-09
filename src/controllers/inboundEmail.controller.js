const Case = require('../models/Case.model');
const Attachment = require('../models/Attachment.model');
const EmailMetadata = require('../models/EmailMetadata.model');
const User = require('../models/User.model');
const path = require('path');
const fs = require('fs').promises;

/**
 * Inbound Email Controller
 * Handles webhook from email providers (SendGrid, AWS SES, etc.)
 * 
 * POST /api/inbound/email
 * 
 * Responsibilities:
 * 1. Parse incoming email data
 * 2. Resolve email to case (via unique case email address)
 * 3. Classify sender as internal or external
 * 4. Store email as attachment with proper attribution
 * 5. Store email metadata
 * 6. Trigger email-to-PDF conversion (async, non-blocking)
 */

/**
 * Handle inbound email webhook
 * POST /api/inbound/email
 */
const handleInboundEmail = async (req, res) => {
  try {
    const {
      to,          // Recipient email (case-specific address)
      from,        // Sender email
      fromName,    // Sender display name (optional)
      subject,     // Email subject
      messageId,   // Unique message ID
      headers,     // Raw headers (optional)
      bodyText,    // Plain text body (optional)
      bodyHtml,    // HTML body (optional)
      attachments, // Array of attachments (optional)
      receivedAt,  // When email was received (optional, defaults to now)
    } = req.body;
    
    // Validate required fields
    if (!to || !from) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: to, from',
      });
    }
    
    // TODO: Resolve 'to' address to caseId
    // For now, we'll expect caseId in the request body for testing
    const { caseId } = req.body;
    
    if (!caseId) {
      return res.status(400).json({
        success: false,
        message: 'Unable to resolve email to case. Case ID is required.',
      });
    }
    
    // Verify case exists
    const caseData = await Case.findOne({ caseId });
    
    if (!caseData) {
      return res.status(404).json({
        success: false,
        message: 'Case not found',
      });
    }
    
    // Normalize sender email
    const normalizedFromEmail = from.toLowerCase().trim();
    
    // Classify sender as internal or external
    // Look up user by email where status is ACTIVE
    const user = await User.findOne({ 
      email: normalizedFromEmail,
      isActive: true 
    });
    
    const isInternal = !!user;
    const visibility = isInternal ? 'internal' : 'external';
    
    // Prepare attribution
    let createdByEmail = normalizedFromEmail;
    let createdByXID = null;
    let createdByName = fromName || null;
    
    if (isInternal) {
      createdByXID = user.xID;
      createdByName = user.name;
    }
    
    // Save email to file system
    // Store as a text file with email metadata and content
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(7);
    const emailFileName = `email-${timestamp}-${randomSuffix}.txt`;
    const uploadsDir = path.join(__dirname, '../../uploads');
    const emailFilePath = path.join(uploadsDir, emailFileName);
    
    // Ensure uploads directory exists
    try {
      await fs.access(uploadsDir);
    } catch {
      await fs.mkdir(uploadsDir, { recursive: true });
    }
    
    // Create email content file
    const emailContent = `
From: ${from}${fromName ? ` (${fromName})` : ''}
To: ${to}
Subject: ${subject || '(no subject)'}
Message-ID: ${messageId || '(none)'}
Date: ${receivedAt || new Date().toISOString()}

${bodyText || '(no text body)'}

---
HTML Body:
${bodyHtml || '(no HTML body)'}
`.trim();
    
    await fs.writeFile(emailFilePath, emailContent, 'utf8');
    
    // Use text/plain MIME type since we're storing as a text file
    // In production, you would store the raw .eml file and use 'message/rfc822'
    const mimeType = 'text/plain';
    
    // Create attachment record
    const attachment = await Attachment.create({
      caseId,
      fileName: `Email from ${from} - ${subject || 'No Subject'}`,
      filePath: emailFilePath,
      description: `Inbound email from ${isInternal ? 'internal' : 'external'} sender`,
      createdBy: createdByEmail,
      createdByXID: createdByXID,
      createdByName: createdByName,
      type: 'email_native',
      source: 'email',
      visibility: visibility,
      mimeType: mimeType,
      note: `Email received at ${receivedAt || new Date().toISOString()}`,
    });
    
    // Create email metadata record
    await EmailMetadata.create({
      attachmentId: attachment._id,
      fromEmail: normalizedFromEmail,
      fromName: fromName || null,
      subject: subject || null,
      messageId: messageId || null,
      receivedAt: receivedAt ? new Date(receivedAt) : new Date(),
      headers: headers || null,
      bodyText: bodyText || null,
      bodyHtml: bodyHtml || null,
    });
    
    // TODO: Trigger async email-to-PDF conversion
    // This should be done in a background job to avoid blocking
    // For now, we'll skip this step
    
    res.status(201).json({
      success: true,
      data: {
        attachmentId: attachment._id,
        caseId: caseId,
        classification: visibility,
        sender: {
          email: normalizedFromEmail,
          name: createdByName,
          xID: createdByXID,
        },
      },
      message: 'Email received and attached to case successfully',
    });
  } catch (error) {
    console.error('[handleInboundEmail] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing inbound email',
      error: error.message,
    });
  }
};

module.exports = {
  handleInboundEmail,
};
