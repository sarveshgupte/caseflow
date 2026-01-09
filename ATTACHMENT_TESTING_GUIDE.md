# Testing Guide: Unified Attachment System

## Overview
This guide covers testing the complete attachment system implementation including view/download, inbound email handling, and external email classification.

## Prerequisites
- MongoDB instance running
- Backend server running on port 5000
- UI running on development server
- Test users with xIDs configured
- Test files (PDF, JPG, DOC)

## Test Cases

### 1. Upload Attachment from Case Detail Page

**Steps:**
1. Login as a user
2. Navigate to an existing case
3. Scroll to the Attachments section (above Comments)
4. Select a PDF file
5. Enter a description
6. Click "Upload File"

**Expected Results:**
- File uploads successfully
- Attachment appears in list with:
  - File icon (📄)
  - Filename
  - "Attached by [Name] (xID)"
  - Timestamp
  - View and Download buttons
  - Description text

### 2. View Attachment (PDF)

**Steps:**
1. Find an attachment in the list
2. Click "View" button

**Expected Results:**
- New browser tab opens
- PDF displays inline in browser
- URL includes xID query parameter
- File is viewable without download

### 3. Download Attachment

**Steps:**
1. Find an attachment in the list
2. Click "Download" button

**Expected Results:**
- File downloads to default download location
- Original filename is preserved
- File opens correctly in appropriate application

### 4. Upload Different File Types

**Test with:**
- PDF (.pdf)
- Image (.jpg, .png)
- Word Document (.doc, .docx)

**Expected Results:**
- All file types upload successfully
- Correct MIME types are stored
- View works for PDF and images
- Download works for all types

### 5. Global Worklist Case Access

**Steps:**
1. Navigate to Global Worklist (Workbasket)
2. Click "View" on a case
3. Verify Attachments section is visible
4. Upload a file
5. View and download the file

**Expected Results:**
- Same functionality as Case Detail page
- Attachments section appears above Comments
- Upload, view, download all work correctly

### 6. Inbound Email - Internal Sender

**Steps:**
1. Send POST to `/api/inbound/email` with:
```json
{
  "caseId": "CASE-20260109-00001",
  "to": "case@docketra.com",
  "from": "employee@company.com",
  "fromName": "John Employee",
  "subject": "Test Email",
  "bodyText": "This is a test email",
  "messageId": "test-123@mail.com"
}
```
Note: `from` email must match an ACTIVE user's email in database

**Expected Results:**
- Email attachment created
- Displayed as: "Attached by [Name] (xID)"
- `visibility` = 'internal'
- `source` = 'email'
- `type` = 'email_native'
- EmailMetadata record created

### 7. Inbound Email - External Sender

**Steps:**
1. Send POST to `/api/inbound/email` with:
```json
{
  "caseId": "CASE-20260109-00001",
  "to": "case@docketra.com",
  "from": "vendor@external.com",
  "fromName": "Vendor Name",
  "subject": "Quotation",
  "bodyText": "Please see attached quotation",
  "messageId": "ext-456@mail.com"
}
```
Note: `from` email must NOT match any user in database

**Expected Results:**
- Email attachment created
- Displayed as:
  - "External Email"
  - "From: vendor@external.com"
- `visibility` = 'external'
- `source` = 'email'
- `type` = 'email_native'
- EmailMetadata record created

### 8. Security Tests

#### 8.1 View Without Authentication
**Steps:**
1. Open view URL without xID parameter
2. Try to access attachment

**Expected Results:**
- 401 Unauthorized error
- Access denied

#### 8.2 View Different User's Case
**Steps:**
1. User A tries to view attachment from case assigned to User B
2. Use User A's xID in query parameter

**Expected Results:**
- Should work (cases are visible to all authenticated users)
- File displays correctly

#### 8.3 Invalid Attachment ID
**Steps:**
1. Try to view attachment with non-existent ID
2. Use valid xID

**Expected Results:**
- 404 Not Found error
- Clear error message

### 9. UI Display Tests

#### 9.1 Attachment Section Position
**Verify:**
- Attachments section appears ABOVE Comments section
- Clear section header "Attachments"
- Proper spacing and styling

#### 9.2 Attribution Display
**Verify Internal:**
- "Attached by John Doe (X123456)"
- Timestamp formatted correctly
- Description shown if present

**Verify External:**
- "External Email"
- "From: sender@email.com"
- "Received on: [timestamp]"
- Description shown if present

### 10. Edge Cases

#### 10.1 No Attachments
**Expected:**
- Message: "No attachments yet"
- Upload section still visible if user has permission

#### 10.2 Large File Upload
**Test:**
- Upload file larger than typical size
- Check upload progress
- Verify completion

#### 10.3 Special Characters in Filename
**Test:**
- Upload file with special chars: `test (1) - copy.pdf`
- Verify filename preserved
- Verify download works

## API Endpoints Reference

### Upload Attachment
```
POST /api/cases/:caseId/attachments
Headers: x-user-id: X123456
Body: multipart/form-data
  - file: [file]
  - description: "Description text"
  - createdBy: "user@email.com"
```

### View Attachment
```
GET /api/cases/:caseId/attachments/:attachmentId/view?xID=X123456
```

### Download Attachment
```
GET /api/cases/:caseId/attachments/:attachmentId/download?xID=X123456
```

### Inbound Email Webhook
```
POST /api/inbound/email
Body: application/json
{
  "caseId": "CASE-20260109-00001",
  "to": "case@docketra.com",
  "from": "sender@email.com",
  "fromName": "Sender Name",
  "subject": "Email Subject",
  "bodyText": "Email body",
  "messageId": "unique-id@mail.com",
  "receivedAt": "2026-01-09T12:00:00Z"
}
```

## Checklist

### Backend
- [ ] View endpoint returns correct MIME type
- [ ] Download endpoint forces download
- [ ] Authentication validates xID from query param
- [ ] File not found returns 404
- [ ] Unauthorized access returns 401
- [ ] Email webhook classifies internal vs external correctly
- [ ] EmailMetadata records created properly

### Frontend
- [ ] View button opens new tab
- [ ] Download button downloads file
- [ ] Attachments appear above comments
- [ ] Internal attribution shows Name (xID)
- [ ] External attribution shows "External Email" + sender
- [ ] Upload works from Case Detail page
- [ ] Upload works from Global Worklist case view
- [ ] File type icons display correctly

### Security
- [ ] No access without authentication
- [ ] XID validation works
- [ ] File paths not exposed in responses
- [ ] MIME types validated
- [ ] No directory traversal vulnerabilities

## Known Limitations

1. **Email-to-PDF Conversion**: Not yet implemented. Marked as TODO for async processing.

2. **Case Email Resolution**: Currently requires caseId in webhook payload. Production implementation should resolve unique case email addresses.

3. **File Size Limits**: Default multer limits apply. Configure as needed for production.

4. **Query Param Authentication**: For production, consider implementing temporary access tokens for view/download links instead of passing xID in query params.

## Troubleshooting

### "File not found on server"
- Check uploads directory exists
- Verify file path in database matches actual file location
- Check file permissions

### "Authentication required"
- Verify xID is passed in query parameter
- Check user exists and is active
- Verify xID format (X123456)

### Email webhook fails
- Verify case exists
- Check request body format
- Verify MongoDB connection
- Check server logs for detailed error

## Manual Test Script

Use this curl script to test the inbound email webhook:

```bash
# Internal email test
curl -X POST http://localhost:5000/api/inbound/email \
  -H "Content-Type: application/json" \
  -d '{
    "caseId": "CASE-20260109-00001",
    "to": "case@docketra.com",
    "from": "internal@company.com",
    "fromName": "Internal User",
    "subject": "Internal Test Email",
    "bodyText": "This is an internal email test",
    "messageId": "internal-test-123"
  }'

# External email test
curl -X POST http://localhost:5000/api/inbound/email \
  -H "Content-Type: application/json" \
  -d '{
    "caseId": "CASE-20260109-00001",
    "to": "case@docketra.com",
    "from": "vendor@external.com",
    "fromName": "External Vendor",
    "subject": "External Test Email",
    "bodyText": "This is an external email test",
    "messageId": "external-test-456"
  }'
```

## Success Criteria

All test cases must pass before considering the implementation complete:
- ✅ Upload from Case Detail and Global Worklist works
- ✅ View and Download buttons work for all file types
- ✅ Internal email attribution shows Name (xID)
- ✅ External email attribution shows "External Email" + sender
- ✅ Attachments appear above comments
- ✅ Security validation works
- ✅ No regressions in existing functionality
