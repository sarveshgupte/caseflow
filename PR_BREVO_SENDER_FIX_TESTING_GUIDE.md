# Manual Testing Guide - Brevo API Sender Format Fix

## Overview
This guide helps you manually test the Brevo API sender format fix to ensure emails send successfully.

---

## Prerequisites

1. **Environment Variables Set:**
   ```bash
   NODE_ENV=production
   BREVO_API_KEY=<your-brevo-api-key>
   MAIL_FROM="Docketra <sarveshgupte@gmail.com>"
   MONGODB_URI=<your-mongodb-uri>
   JWT_SECRET=<your-jwt-secret>
   FRONTEND_URL=<your-frontend-url>
   ```

2. **Brevo Account:**
   - Account created at https://www.brevo.com/
   - API key generated
   - Sender email verified in Brevo

---

## Test 1: Server Startup Validation

### Purpose
Verify that the server validates `MAIL_FROM` format on startup.

### Steps
1. Start the server:
   ```bash
   npm start
   ```

2. Check the logs for:
   ```
   [EMAIL] Using sender: Docketra <sarveshgupte@gmail.com>
   [EMAIL] Brevo API configured for production email delivery.
   ```

### Expected Result
✅ Server starts successfully  
✅ Logs show parsed sender information  
✅ No errors about invalid MAIL_FROM format

---

## Test 2: Test Email Endpoint

### Purpose
Send a test email through the debug endpoint to verify Brevo API integration.

### Prerequisites
- Admin user logged in
- Admin JWT token available

### Steps

1. Login as admin to get JWT token:
   ```bash
   curl -X POST http://localhost:5000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"xID": "ADMIN_XID", "password": "admin_password"}'
   ```

2. Send test email:
   ```bash
   curl -X GET "http://localhost:5000/api/debug/email-test?email=your-test@email.com" \
     -H "Authorization: Bearer YOUR_JWT_TOKEN"
   ```

3. Check server logs for:
   ```
   [EMAIL] Using sender: Docketra <sarveshgupte@gmail.com>
   [EMAIL] Sending email via Brevo API
   [EMAIL] Sending email via Brevo API to yo***@email.com
   [EMAIL] Email sent successfully via Brevo: <message-id>
   ```

### Expected Result
✅ API returns 200 OK  
✅ Response includes `messageId`  
✅ Logs show sender format  
✅ Logs show "Email sent successfully via Brevo"  
✅ Email received in inbox

### Response Example
```json
{
  "success": true,
  "message": "Test email sent successfully",
  "recipient": "your-test@email.com",
  "messageId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "timestamp": "2026-01-09T09:00:00.000Z",
  "emailConfig": {
    "service": "Brevo API",
    "apiKey": "Configured",
    "from": "Docketra <sarveshgupte@gmail.com>"
  }
}
```

---

## Test 3: User Invite Email

### Purpose
Test the actual use case - sending a user invite email.

### Prerequisites
- Admin user logged in
- Admin JWT token available

### Steps

1. Create a new user (sends invite email):
   ```bash
   curl -X POST http://localhost:5000/api/admin/users \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -d '{
       "name": "Test User",
       "email": "testuser@example.com",
       "xID": "TEST001",
       "role": "user"
     }'
   ```

2. Check server logs for:
   ```
   [EMAIL] Using sender: Docketra <sarveshgupte@gmail.com>
   [EMAIL] Sending email via Brevo API
   [EMAIL] Email sent successfully via Brevo: <message-id>
   ```

3. Check email inbox for invite email

### Expected Result
✅ User created successfully  
✅ Invite email sent  
✅ Email received with setup link  
✅ Logs show correct sender format  
✅ No Brevo API errors

---

## Test 4: Invite Resend

### Purpose
Test the resend invite functionality.

### Steps

1. Resend invite to existing user:
   ```bash
   curl -X POST http://localhost:5000/api/admin/users/TEST001/resend-invite \
     -H "Authorization: Bearer YOUR_JWT_TOKEN"
   ```

2. Check server logs

3. Check email inbox

### Expected Result
✅ Resend successful  
✅ Email received  
✅ No Brevo API errors  
✅ Logs show correct sender format

---

## Test 5: Brevo Dashboard Verification

### Purpose
Verify emails in Brevo Transactional Logs.

### Steps

1. Login to Brevo dashboard: https://app.brevo.com/

2. Navigate to: **Transactional > Logs**

3. Check recent email logs

### Expected Result
✅ Emails show status: **Sent**  
✅ From address: `Docketra <sarveshgupte@gmail.com>`  
✅ No errors or bounces  
✅ Delivery rate: 100%

---

## Test 6: Invalid MAIL_FROM Format

### Purpose
Verify server fails fast on invalid format.

### Steps

1. Stop the server

2. Set invalid MAIL_FROM:
   ```bash
   export MAIL_FROM="Docketra <invalid-no-at-sign>"
   ```

3. Try to start server:
   ```bash
   npm start
   ```

### Expected Result
❌ Server fails to start  
✅ Error message displayed:
```
❌ Error: Invalid MAIL_FROM format.
Invalid email format in MAIL_FROM: "invalid-no-at-sign"
Expected format: "Name <email@domain>" or "email@domain"
Current value: Docketra <invalid-no-at-sign>
```

---

## Troubleshooting

### Issue: "valid sender email required" error

**Cause:** MAIL_FROM is not in correct format  
**Solution:** 
1. Check MAIL_FROM format: `"Name <email@domain>"`
2. Verify sender email is verified in Brevo
3. Check server logs for parsed sender

### Issue: API Key error

**Cause:** BREVO_API_KEY not set or invalid  
**Solution:**
1. Verify BREVO_API_KEY is set
2. Check API key is valid in Brevo dashboard
3. Regenerate API key if needed

### Issue: Email not received

**Possible causes:**
1. Check spam folder
2. Verify recipient email is valid
3. Check Brevo dashboard for delivery status
4. Verify sender email is verified in Brevo

---

## Success Criteria Checklist

✅ Server starts successfully with correct MAIL_FROM  
✅ Server logs show: `[EMAIL] Using sender: Name <email>`  
✅ Test email sends successfully  
✅ User invite emails send successfully  
✅ Invite resend works  
✅ Brevo dashboard shows emails as **Sent**  
✅ No "valid sender email required" errors  
✅ Server fails fast on invalid MAIL_FROM  
✅ API key not logged anywhere  
✅ Emails received in inbox

---

## Additional Notes

### Development Mode
In development mode (`NODE_ENV=development`):
- Emails are logged to console only
- No actual emails sent
- Brevo API not called
- Useful for local testing without API key

### Production Mode
In production mode (`NODE_ENV=production`):
- Emails sent via Brevo API
- BREVO_API_KEY required
- MAIL_FROM required and validated
- Server fails fast on missing/invalid config

---

**Testing Guide Version:** 1.0  
**Last Updated:** 2026-01-09  
**Status:** Ready for Testing
