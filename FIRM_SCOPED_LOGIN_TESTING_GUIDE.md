# Firm-Scoped Login Testing Guide

## Overview
This guide helps you test the firm-scoped login implementation.

## Prerequisites
- MongoDB running locally or accessible connection string
- Backend server running on port 5000
- Frontend built and accessible

## Test Scenarios

### 1. Create a Firm with Slug Generation

**Endpoint:** `POST /api/superadmin/firms`

**Request:**
```json
{
  "name": "Teekeet Store",
  "adminName": "John Doe",
  "adminEmail": "john@teekeet.com"
}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Firm created successfully with default client and admin. Admin credentials sent by email.",
  "data": {
    "firm": {
      "firmId": "FIRM001",
      "firmSlug": "teekeet-store",
      "name": "Teekeet Store",
      "status": "ACTIVE"
    },
    "defaultClient": {
      "clientId": "C000001",
      "businessName": "Teekeet Store"
    },
    "admin": {
      "xID": "X000001"
    }
  }
}
```

**Verify:**
- ✓ firmSlug is generated correctly ("teekeet-store")
- ✓ firmSlug is URL-safe (lowercase, hyphens, no special chars)
- ✓ Firm is created with ACTIVE status

### 2. List Firms and Verify firmSlug

**Endpoint:** `GET /api/superadmin/firms`

**Expected Response:**
```json
{
  "success": true,
  "data": [
    {
      "firmId": "FIRM001",
      "firmSlug": "teekeet-store",
      "name": "Teekeet Store",
      "status": "ACTIVE",
      "clientCount": 1,
      "userCount": 1
    }
  ]
}
```

**Verify:**
- ✓ firmSlug is included in response
- ✓ firmSlug matches what was generated during creation

### 3. Get Firm Metadata by Slug (Public API)

**Endpoint:** `GET /api/public/firms/teekeet-store`

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "firmId": "FIRM001",
    "firmSlug": "teekeet-store",
    "name": "Teekeet Store",
    "status": "ACTIVE",
    "isActive": true
  }
}
```

**Verify:**
- ✓ Public endpoint works without authentication
- ✓ Returns firm metadata for display on login page
- ✓ Returns 404 for invalid firmSlug

### 4. Firm-Scoped Login

**Endpoint:** `POST /api/auth/login`

**Request:**
```json
{
  "xID": "X000001",
  "password": "user_password",
  "firmSlug": "teekeet-store"
}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "accessToken": "jwt_token...",
  "refreshToken": "refresh_token...",
  "data": {
    "xID": "X000001",
    "role": "Admin",
    "firmId": "mongodb_object_id",
    "defaultClientId": "mongodb_object_id"
  }
}
```

**Verify:**
- ✓ Login succeeds with correct firmSlug + xID + password
- ✓ Login fails with incorrect firmSlug
- ✓ Login fails with xID from different firm

### 5. Test Multiple Firms with Same xID

**Step 1:** Create first firm
```bash
POST /api/superadmin/firms
{
  "name": "Firm Alpha",
  "adminName": "Admin Alpha",
  "adminEmail": "admin@alpha.com"
}
```
Expected: firmSlug = "firm-alpha", admin xID = "X000001"

**Step 2:** Create second firm
```bash
POST /api/superadmin/firms
{
  "name": "Firm Beta",
  "adminName": "Admin Beta",
  "adminEmail": "admin@beta.com"
}
```
Expected: firmSlug = "firm-beta", admin xID = "X000001"

**Step 3:** Verify both firms have X000001 users
```bash
# This should work - no E11000 error because (firmId, xID) is unique
# Both firms can have X000001 user
```

**Step 4:** Test firm-scoped login for Firm Alpha
```bash
POST /api/auth/login
{
  "xID": "X000001",
  "password": "alpha_password",
  "firmSlug": "firm-alpha"
}
```
Expected: Login succeeds for Firm Alpha's X000001

**Step 5:** Test firm-scoped login for Firm Beta
```bash
POST /api/auth/login
{
  "xID": "X000001",
  "password": "beta_password",
  "firmSlug": "firm-beta"
}
```
Expected: Login succeeds for Firm Beta's X000001

**Verify:**
- ✓ No E11000 duplicate key errors
- ✓ Both firms can have X000001 user
- ✓ Each firm's X000001 can login via their firm-specific URL
- ✓ Cross-firm isolation maintained

### 6. Test Unique Slug Generation

**Step 1:** Create firm with name "Docketra"
Expected: firmSlug = "docketra"

**Step 2:** Create another firm with name "Docketra"
Expected: firmSlug = "docketra-1" (auto-incremented)

**Step 3:** Create another firm with name "Docketra"
Expected: firmSlug = "docketra-2"

**Verify:**
- ✓ Slug uniqueness is enforced
- ✓ Duplicate names get auto-incremented suffix

## Frontend Testing

### 7. SuperAdmin Firms Management Page

**URL:** `/superadmin/firms`

**Verify:**
- ✓ Table displays "Firm Login URL" column
- ✓ Each firm shows clickable URL: `/f/{firmSlug}/login`
- ✓ Clicking URL opens firm login page in new tab
- ✓ URL format is correct

### 8. Firm Login Page

**URL:** `/f/teekeet-store/login`

**Verify:**
- ✓ Page loads successfully
- ✓ Displays firm name from metadata API
- ✓ Displays firm ID
- ✓ Shows "🔒 Secure firm-scoped login" badge
- ✓ Login form includes firmSlug in request
- ✓ Successful login redirects to dashboard
- ✓ Invalid firmSlug shows error message

### 9. Invalid Firm Slug

**URL:** `/f/nonexistent-firm/login`

**Verify:**
- ✓ Shows "Firm not found" error
- ✓ Suggests contacting administrator
- ✓ Does not allow login

### 10. Inactive Firm

**Step 1:** Suspend a firm via SuperAdmin
```bash
PATCH /api/superadmin/firms/{firmId}
{
  "status": "SUSPENDED"
}
```

**Step 2:** Try to access firm login
**URL:** `/f/{firmSlug}/login`

**Verify:**
- ✓ Shows "This firm is currently inactive" error
- ✓ Does not allow login
- ✓ Suggests contacting support

## Security Verification

### 11. firmSlug Immutability

**Attempt:** Try to update firmSlug via any API
**Expected:** Should fail (immutable field)

### 12. Audit Logging

**Verify:**
- ✓ AuthAudit logs include firmSlug in description
- ✓ Login attempts log firmSlug or 'none' if not provided
- ✓ Failed logins log firmSlug for debugging

### 13. Legacy Login Support

**Test:** Login without firmSlug (for backward compatibility)
```json
{
  "xID": "X000001",
  "password": "password"
}
```

**Expected:**
- ✓ Works if only one user with that xID exists
- ✓ Fails with helpful message if multiple users exist
- ✓ Message suggests using firm-specific login URL

## Summary

All test scenarios should pass to confirm:
1. ✅ firmSlug is generated correctly and uniquely
2. ✅ Firm creation includes firmSlug
3. ✅ Firm-scoped login works via firmSlug
4. ✅ Multiple firms can have same xID (e.g., X000001)
5. ✅ SuperAdmin can see and share firm login URLs
6. ✅ Frontend displays firm-specific login pages
7. ✅ Security guardrails are in place
8. ✅ Audit logging includes firmSlug
