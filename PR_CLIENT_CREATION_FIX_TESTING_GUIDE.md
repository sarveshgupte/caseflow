# Manual Testing Guide - Client Creation Fix

## Prerequisites

Before testing, ensure:
- [ ] Application is running (backend + frontend)
- [ ] MongoDB is connected
- [ ] You have System Admin credentials
- [ ] Browser DevTools Network tab is open

---

## Test Suite 1: Successful Client Creation

### Test 1.1: Create Client with Required Fields Only

**Steps:**
1. Log in as System Admin
2. Navigate to Admin Panel → Client Management tab
3. Click "+ Create Client" button
4. Fill in the form:
   - Business Name: `Test Corporation`
   - Business Address: `123 Test Street, Test City`
   - Primary Contact Number: `+1234567890`
   - Business Email: `test@testcorp.com`
5. Leave optional fields empty (Secondary Contact, PAN, TAN, GST, CIN)
6. Click "Create Client"

**Expected Result:**
- ✅ Success toast: "Client created successfully! Client ID: C000XXX"
- ✅ Modal closes
- ✅ Client appears in the table
- ✅ Network tab shows POST request with status 201

**Verify Network Payload:**
```json
{
  "businessName": "Test Corporation",
  "businessAddress": "123 Test Street, Test City",
  "primaryContactNumber": "+1234567890",
  "businessEmail": "test@testcorp.com"
}
```

**Verify Payload DOES NOT contain:**
- ❌ `latitude`
- ❌ `longitude`
- ❌ `businessPhone`
- ❌ `createdByXid`
- ❌ `isSystemClient`
- ❌ `status`

---

### Test 1.2: Create Client with All Optional Fields

**Steps:**
1. Click "+ Create Client" again
2. Fill in ALL fields including optional ones:
   - Business Name: `Full Data Corp`
   - Business Address: `456 Full Street`
   - Primary Contact Number: `+9876543210`
   - Secondary Contact Number: `+1112223333`
   - Business Email: `full@datacorp.com`
   - PAN: `ABCDE1234F`
   - TAN: `ABCD12345E`
   - GST: `12ABCDE3456F1Z5`
   - CIN: `U12345MH2020PTC123456`
3. Click "Create Client"

**Expected Result:**
- ✅ Success toast with Client ID
- ✅ All fields saved correctly
- ✅ Network payload includes all filled fields (except deprecated ones)

**Verify Network Payload:**
```json
{
  "businessName": "Full Data Corp",
  "businessAddress": "456 Full Street",
  "primaryContactNumber": "+9876543210",
  "secondaryContactNumber": "+1112223333",
  "businessEmail": "full@datacorp.com",
  "PAN": "ABCDE1234F",
  "TAN": "ABCD12345E",
  "GST": "12ABCDE3456F1Z5",
  "CIN": "U12345MH2020PTC123456"
}
```

---

## Test Suite 2: Validation Testing

### Test 2.1: Missing Required Fields

**Steps:**
1. Click "+ Create Client"
2. Leave Business Name empty
3. Fill other required fields
4. Click "Create Client"

**Expected Result:**
- ❌ Error toast: "Please fill in all required fields"
- ❌ Modal stays open

**Repeat for each required field:**
- Business Name (empty)
- Business Address (empty)
- Primary Contact Number (empty)
- Business Email (empty)

---

### Test 2.2: Invalid Email Format

**Steps:**
1. Click "+ Create Client"
2. Fill all fields but use invalid email: `notanemail`
3. Click "Create Client"

**Expected Result:**
- ❌ Browser HTML5 validation should catch this
- OR backend returns: "Business email is required" (if empty after trim)

---

## Test Suite 3: Backend Validation Testing

### Test 3.1: Attempt to Send Unexpected Fields (Using Browser Console)

**Steps:**
1. Open Browser DevTools Console
2. Run this command:
```javascript
fetch('/api/clients', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + localStorage.getItem('token') // Adjust based on your auth
  },
  body: JSON.stringify({
    businessName: "Hacker Corp",
    businessAddress: "123 Hack St",
    primaryContactNumber: "1234567890",
    businessEmail: "hack@corp.com",
    isSystemClient: true, // ❌ Unexpected field
    createdByXid: "X999999" // ❌ Unexpected field
  })
})
.then(r => r.json())
.then(console.log);
```

**Expected Result:**
```json
{
  "success": false,
  "message": "Unexpected field(s) in client payload: isSystemClient, createdByXid"
}
```

**Status Code:** 400

---

### Test 3.2: Attempt to Send Deprecated Fields (Using Browser Console)

**Steps:**
1. Open Browser DevTools Console
2. Run this command:
```javascript
fetch('/api/clients', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + localStorage.getItem('token')
  },
  body: JSON.stringify({
    businessName: "Legacy Corp",
    businessAddress: "123 Old St",
    primaryContactNumber: "1234567890",
    businessEmail: "legacy@corp.com",
    latitude: 40.7128, // ❌ Deprecated field
    longitude: -74.0060, // ❌ Deprecated field
    businessPhone: "9999999999" // ❌ Deprecated field
  })
})
.then(r => r.json())
.then(console.log);
```

**Expected Result:**
- ✅ Request succeeds (deprecated fields are stripped, not rejected)
- ✅ Client is created
- ✅ Deprecated fields are NOT in the database

```json
{
  "success": true,
  "data": {
    "clientId": "C000XXX",
    "businessName": "Legacy Corp",
    // ... other fields
    // NO latitude, longitude, or businessPhone
  }
}
```

**Verify in MongoDB:**
```javascript
db.clients.findOne({ businessName: "Legacy Corp" })
// Should NOT have latitude, longitude, or businessPhone fields
```

---

## Test Suite 4: Edit Client Testing

### Test 4.1: Edit Existing Client

**Steps:**
1. Find a client in the table
2. Click "Edit" button
3. Verify form shows:
   - ✅ Business Name (disabled)
   - ✅ Business Address (disabled)
   - ✅ Primary Contact Number (enabled)
   - ✅ Secondary Contact Number (enabled)
   - ✅ Business Email (enabled)
   - ✅ PAN, TAN, GST, CIN (disabled)
   - ❌ NO Latitude field
   - ❌ NO Longitude field
4. Change Primary Contact Number to a new value
5. Click "Update Client"

**Expected Result:**
- ✅ Success toast: "Client updated successfully"
- ✅ New contact number is saved
- ✅ Network payload only includes editable fields

**Verify Network Payload:**
```json
{
  "businessEmail": "test@testcorp.com",
  "primaryContactNumber": "+9999999999",
  "secondaryContactNumber": ""
}
```

---

## Test Suite 5: Backward Compatibility Testing

### Test 5.1: View Existing Client with Deprecated Fields

**If you have existing clients with `latitude`, `longitude`, or `businessPhone` in the database:**

**Steps:**
1. Navigate to Client Management tab
2. Find a client that was created before this fix
3. Verify the client appears in the table
4. Click "Edit" on that client

**Expected Result:**
- ✅ Client data loads correctly
- ✅ No errors in console
- ✅ If old client has `businessPhone`, it's used as fallback for display
- ✅ NO latitude/longitude fields in edit form

---

## Test Suite 6: Authorization Testing

### Test 6.1: Non-Admin Cannot Create Clients

**Steps:**
1. Log out from Admin account
2. Log in as a regular Employee user
3. Navigate to Admin Panel

**Expected Result:**
- ❌ Client Management tab should not be visible
- OR Client Management tab is visible but "+ Create Client" is disabled
- OR Attempting to access `/api/clients` via console returns 403 Forbidden

**Using Browser Console:**
```javascript
fetch('/api/clients', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + localStorage.getItem('token')
  },
  body: JSON.stringify({
    businessName: "Unauthorized Corp",
    businessAddress: "123 Unauth St",
    primaryContactNumber: "1234567890",
    businessEmail: "unauth@corp.com"
  })
})
.then(r => r.json())
.then(console.log);
```

**Expected Result:**
```json
{
  "success": false,
  "message": "Forbidden: Admin role required"
}
```

**Status Code:** 403

---

## Test Suite 7: Error Logging Verification

### Test 7.1: Check Server Logs for Detailed Errors

**Steps:**
1. In browser console, send a malformed request:
```javascript
fetch('/api/clients', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + localStorage.getItem('token')
  },
  body: JSON.stringify({
    businessName: "A".repeat(1000), // Very long name
    businessAddress: "Test",
    primaryContactNumber: "123",
    businessEmail: "test@test.com"
  })
})
.then(r => r.json())
.then(console.log);
```

2. Check server logs (terminal where backend is running)

**Expected Result:**
Server logs should show:
```
❌ Client creation failed
Error message: [specific error message]
Validation errors: [if any MongoDB validation errors]
```

---

## Test Suite 8: Database Integrity Testing

### Test 8.1: Verify System-Owned Fields

**Steps:**
1. Create a client via the UI as System Admin
2. Check the MongoDB database

**Using MongoDB Shell:**
```javascript
db.clients.findOne({ businessName: "Test Corporation" })
```

**Expected Result:**
```javascript
{
  "_id": ObjectId("..."),
  "clientId": "C000XXX",
  "businessName": "Test Corporation",
  "businessAddress": "123 Test Street, Test City",
  "businessEmail": "test@testcorp.com",
  "primaryContactNumber": "+1234567890",
  
  // System-owned fields (set server-side)
  "createdByXid": "X000001", // Should match logged-in admin's xID
  "createdBy": "admin@company.com", // Should match admin's email
  "isSystemClient": false,
  "isActive": true,
  "status": "ACTIVE",
  "previousBusinessNames": [],
  
  // Timestamps
  "createdAt": ISODate("..."),
  "updatedAt": ISODate("..."),
  
  // Should NOT have these fields:
  // ❌ latitude
  // ❌ longitude
  // ❌ businessPhone (unless explicitly set)
}
```

---

## Test Suite 9: Performance Testing

### Test 9.1: Create Multiple Clients Rapidly

**Steps:**
1. Create 10 clients in quick succession
2. Monitor for any errors or slowdowns

**Expected Result:**
- ✅ All clients are created successfully
- ✅ No race conditions or duplicate IDs
- ✅ Server remains responsive

---

## Test Suite 10: Edge Cases

### Test 10.1: Very Long Business Name

**Steps:**
1. Create client with business name of 500 characters
2. Click "Create Client"

**Expected Result:**
- ✅ Should succeed (no length limit currently enforced)
- OR ❌ Should fail gracefully with clear error message

---

### Test 10.2: Special Characters in Fields

**Steps:**
1. Create client with:
   - Business Name: `Test & Co. <script>alert('xss')</script>`
   - Business Address: `123 O'Malley's Street, Suite #4-B`
   - Business Email: `test+tag@domain.co.uk`

**Expected Result:**
- ✅ Client is created successfully
- ✅ Special characters are preserved (not escaped in DB)
- ❌ XSS should be handled at display layer (out of scope for this PR)

---

### Test 10.3: Unicode Characters

**Steps:**
1. Create client with:
   - Business Name: `测试公司 (Test Company)`
   - Business Address: `日本東京都`

**Expected Result:**
- ✅ Client is created successfully
- ✅ Unicode characters are preserved correctly

---

## Test Suite 11: Regression Testing

### Test 11.1: Existing Client Retrieval

**Steps:**
1. Navigate to Client Management tab
2. Verify all existing clients are displayed
3. Click on various clients to view details

**Expected Result:**
- ✅ All existing clients are visible
- ✅ No errors in console
- ✅ Client details load correctly

---

### Test 11.2: Case Creation with Client Selection

**Steps:**
1. Navigate to Create Case page
2. Select a client from the dropdown
3. Verify client details populate correctly

**Expected Result:**
- ✅ Client dropdown shows all active clients
- ✅ Selecting a client populates fields correctly
- ✅ Case can be created with selected client

---

## Test Suite 12: Accessibility Testing

### Test 12.1: Keyboard Navigation

**Steps:**
1. Navigate to Client Management tab using only keyboard (Tab key)
2. Open client modal using Enter key
3. Fill form using Tab and keyboard input
4. Submit using Enter key

**Expected Result:**
- ✅ All interactive elements are keyboard accessible
- ✅ Tab order is logical
- ✅ Form can be submitted via keyboard

---

## Test Results Summary

After completing all tests, fill in this summary:

| Test Suite | Total Tests | Passed | Failed | Notes |
|------------|-------------|--------|--------|-------|
| 1. Successful Creation | 2 | __ | __ | |
| 2. Validation | 2 | __ | __ | |
| 3. Backend Validation | 2 | __ | __ | |
| 4. Edit Client | 1 | __ | __ | |
| 5. Backward Compatibility | 1 | __ | __ | |
| 6. Authorization | 1 | __ | __ | |
| 7. Error Logging | 1 | __ | __ | |
| 8. Database Integrity | 1 | __ | __ | |
| 9. Performance | 1 | __ | __ | |
| 10. Edge Cases | 3 | __ | __ | |
| 11. Regression | 2 | __ | __ | |
| 12. Accessibility | 1 | __ | __ | |
| **TOTAL** | **18** | **__** | **__** | |

---

## Sign-Off

**Tested By:** ___________________

**Date:** ___________________

**Environment:** (Development / Staging / Production)

**Approval:** ☐ PASSED ☐ FAILED (with issues documented above)

---

## Troubleshooting Common Issues

### Issue 1: "Network Error" when creating client
**Possible Causes:**
- Backend server is not running
- MongoDB is not connected
- CORS issue

**Solution:**
- Check backend logs
- Verify MongoDB connection
- Check browser console for CORS errors

### Issue 2: Client created but not visible in table
**Possible Causes:**
- Frontend not refreshing after creation
- Filter applied (activeOnly=true)

**Solution:**
- Refresh the page manually
- Check if client was created in MongoDB
- Verify `isActive` flag is true

### Issue 3: "Unexpected field" error despite using frontend form
**Possible Causes:**
- Stale frontend build
- Browser cache

**Solution:**
- Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
- Clear browser cache
- Rebuild frontend: `npm run build`

### Issue 4: Admin cannot create clients (403 Forbidden)
**Possible Causes:**
- User is not actually an Admin
- Auth token expired

**Solution:**
- Verify user role in database
- Log out and log back in
- Check backend logs for auth errors
