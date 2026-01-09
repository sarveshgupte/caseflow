# Security Summary: Unified Attachment System

## Overview
This document outlines the security measures implemented in the attachment system and identifies areas for future improvement.

## Security Measures Implemented

### 1. Authentication & Authorization
- **All attachment endpoints require authentication**
  - View: `/api/cases/:caseId/attachments/:attachmentId/view?xID=X123456`
  - Download: `/api/cases/:caseId/attachments/:attachmentId/download?xID=X123456`
  - Upload: Requires authenticated user via x-user-id header

- **User Validation**
  - xID validated against active users in database
  - User must be active (isActive = true)
  - Full user object attached to request

- **Case Access Validation**
  - Verifies case exists before allowing attachment access
  - Validates attachment belongs to specified case
  - Prevents cross-case attachment access

### 2. File Security

#### Input Sanitization
- **Filename Sanitization** (NEW)
  - Removes control characters (newlines, tabs)
  - Removes non-printable ASCII characters
  - Removes quotes to prevent header injection
  - Limits filename length to 255 characters
  - Prevents HTTP header injection attacks

#### MIME Type Validation
- **Type Detection**
  - MIME types determined by file extension
  - Whitelist of allowed MIME types
  - Defaults to 'application/octet-stream' for unknown types
  - Prevents MIME type confusion attacks

#### File Storage
- **Isolated Storage**
  - Files stored in dedicated uploads/ directory
  - Unique filenames generated: `timestamp-random.ext`
  - Original filenames preserved in database only
  - No direct file path exposure in API responses

#### File Access
- **Path Validation**
  - File paths resolved to absolute paths
  - File existence verified before serving
  - No directory traversal possible
  - Uses Node.js `res.sendFile()` with validated paths

### 3. Email Webhook Security

#### Input Validation
- **Required Fields**
  - Validates presence of `to` and `from` addresses
  - Case ID validation (case must exist)

#### Email Classification
- **Internal vs External Detection**
  - Sender email normalized (lowercase, trimmed)
  - Lookup against active users only
  - No identity inference from display names
  - Strict email-based classification

#### Attribution Integrity
- **Immutable Records**
  - Attachment records cannot be updated
  - Attachment records cannot be deleted
  - Email metadata records are immutable
  - createdAt timestamps server-generated and immutable

### 4. Data Integrity

#### Immutability
- **Mongoose Pre-hooks**
  - Block all update operations on Attachment model
  - Block all update operations on EmailMetadata model
  - Block all delete operations on both models
  - Enforces audit trail integrity

#### Audit Logging
- **Case Audit Integration**
  - File attachments logged in CaseAudit
  - xID attribution for all actions
  - Sanitized filenames in audit logs (prevents log injection)

### 5. Protection Against Common Vulnerabilities

#### ✅ IMPLEMENTED
1. **SQL Injection**: N/A (using MongoDB with Mongoose)
2. **NoSQL Injection**: Protected by Mongoose schema validation
3. **Path Traversal**: Validated file paths, no user-supplied paths
4. **Header Injection**: Filename sanitization implemented
5. **XSS**: Server-side only, no user-generated HTML
6. **CSRF**: Not applicable for API endpoints
7. **File Upload Attacks**: MIME type validation, unique filenames
8. **Log Injection**: Sanitized filenames in audit logs

#### ⚠️ KNOWN LIMITATIONS (See Recommendations)
1. **Query Parameter Authentication**: xID passed in URL query params

## Known Limitations & Recommendations

### 1. Query Parameter Authentication (Medium Priority)

**Current Implementation:**
```javascript
viewAttachment: (caseId, attachmentId) => {
  const xID = localStorage.getItem(STORAGE_KEYS.X_ID);
  const url = `${apiBaseUrl}/api/cases/${caseId}/attachments/${attachmentId}/view?xID=${xID}`;
  window.open(url, '_blank');
}
```

**Security Concerns:**
- xID exposed in browser history
- xID exposed in server access logs
- xID exposed in referrer headers if user navigates from attachment
- Potential for credential leakage in analytics tools

**Recommended Solution:**
Implement temporary access tokens for attachment access:

```javascript
// Step 1: Request temporary token
const tokenResponse = await api.post(`/cases/${caseId}/attachments/${attachmentId}/token`, {
  action: 'view', // or 'download'
  expiresIn: 300  // 5 minutes
});

// Step 2: Use token in URL
const url = `${apiBaseUrl}/api/cases/${caseId}/attachments/${attachmentId}/view?token=${tokenResponse.token}`;
window.open(url, '_blank');
```

**Token Implementation:**
- Generate JWT with short expiration (5 minutes)
- Include: caseId, attachmentId, action, userId, expiration
- Validate token in middleware
- Single-use tokens for downloads (optional)

**Priority:** Medium - Current implementation is functional but not ideal for production

### 2. Email-to-PDF Conversion (Low Priority)

**Current Status:**
- Marked as TODO in code
- Emails stored as text files
- No PDF generation implemented

**Recommendation:**
- Implement asynchronous job queue (e.g., Bull, Agenda)
- Use library like Puppeteer or wkhtmltopdf
- Store both original email and PDF version
- Link via attachment relationships

**Priority:** Low - Not a security issue, feature enhancement

### 3. File Size Limits (Medium Priority)

**Current Status:**
- Using default multer limits
- No explicit size restrictions documented

**Recommendation:**
- Set explicit file size limits (e.g., 25MB)
- Document limits in API
- Return clear error messages
- Consider scanning for malware in production

**Priority:** Medium - Important for production deployment

### 4. Inbound Email Case Resolution (Medium Priority)

**Current Status:**
- Requires caseId in request body
- No automatic email-to-case mapping

**Recommendation:**
- Generate unique email addresses per case
- Format: `case-{caseId}@inbound.docketra.com`
- Parse recipient address to extract caseId
- Validate case exists before processing

**Priority:** Medium - Required for production email integration

### 5. Rate Limiting (High Priority for Production)

**Current Status:**
- No rate limiting implemented

**Recommendation:**
- Implement rate limiting for:
  - File uploads (e.g., 10 per minute per user)
  - View/download (e.g., 100 per minute per user)
  - Email webhook (e.g., 50 per minute per sender)
- Use express-rate-limit or similar
- Log rate limit violations

**Priority:** High - Critical for production deployment

## Security Testing Checklist

### Manual Testing
- [ ] Upload file with special characters in name
- [ ] Upload file with newlines in name
- [ ] Try to access attachment without authentication
- [ ] Try to access another user's case attachment
- [ ] Try to access non-existent attachment
- [ ] Upload very large file
- [ ] Upload file with no extension
- [ ] Upload file with multiple extensions (.pdf.exe)
- [ ] Test email webhook with SQL injection in fields
- [ ] Test email webhook with XSS payloads
- [ ] Test email webhook with very long field values

### Automated Testing
- [ ] Run CodeQL security scanner
- [ ] Run npm audit for dependency vulnerabilities
- [ ] Test authentication bypass attempts
- [ ] Test path traversal attempts
- [ ] Fuzz test file upload endpoint

## Incident Response

### If Credential Leakage Suspected
1. Rotate JWT secrets immediately
2. Force password reset for affected users
3. Review server logs for unauthorized access
4. Implement temporary access tokens

### If Malicious File Uploaded
1. Quarantine file immediately
2. Block user account
3. Scan all attachments with malware scanner
4. Review all attachments from same user
5. Consider implementing virus scanning

### If Header Injection Found
1. Deploy filename sanitization fix immediately
2. Review all existing attachment filenames
3. Sanitize any malicious filenames in database
4. Check for evidence of exploitation

## Compliance Considerations

### Data Protection (GDPR, CCPA)
- **Personal Data**: Email addresses stored for external senders
- **Right to Access**: Users can view their attachments
- **Right to Deletion**: Attachments are immutable (compliance concern)
- **Recommendation**: Implement soft-delete with anonymization

### Audit Requirements
- **Audit Trail**: Complete via CaseAudit model
- **Immutability**: Enforced by Mongoose hooks
- **Attribution**: xID-based tracking
- **Timestamps**: Server-generated, immutable

### Data Retention
- **Current**: No automatic cleanup
- **Recommendation**: Implement retention policy
  - Archive cases after X years
  - Mark attachments for deletion
  - Physical deletion after grace period

## Conclusion

The implemented attachment system provides a solid security foundation with:
- ✅ Strong authentication and authorization
- ✅ File sanitization and validation
- ✅ Immutable audit trails
- ✅ Protection against common vulnerabilities

**Priority Improvements for Production:**
1. **High**: Implement rate limiting
2. **Medium**: Replace query param auth with temporary tokens
3. **Medium**: Add explicit file size limits
4. **Medium**: Implement email-to-case resolution
5. **Low**: Add email-to-PDF conversion

The system is suitable for development and internal testing but requires the high-priority improvements before production deployment.

## Code Review Findings Addressed

1. ✅ **MIME Type Duplication**: Extracted to shared utility function
2. ✅ **Header Injection**: Implemented filename sanitization
3. ✅ **MIME Type Mismatch**: Corrected to use 'text/plain' for text files
4. ⚠️ **Query Param Auth**: Documented as limitation with recommended solution

All critical security issues from code review have been addressed.
