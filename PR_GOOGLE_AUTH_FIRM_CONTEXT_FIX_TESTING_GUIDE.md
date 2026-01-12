# Google Auth + Firm Context Fix - Testing Guide

## Overview
This document provides comprehensive testing procedures for the Google OAuth and firm context fixes implemented to address production issues.

## Prerequisites
- MongoDB instance running
- Environment variables configured (see `.env.example`)
- At least one firm created with users
- Google OAuth credentials configured

## Changes Summary

### 1. Enforce `mustSetPassword` on Google Login
- Google login is now blocked if `user.mustSetPassword === true`
- User is redirected to `/set-password` page instead of being logged in

### 2. Firm Context in JWT Tokens
- JWT tokens now include: `firmId`, `firmSlug`, `defaultClientId`
- All token generation paths include firm context
- SuperAdmin tokens exclude firm context (as before)

### 3. Profile Endpoint Enhancement
- `/api/auth/profile` now returns `firmSlug` and `defaultClientId`
- Frontend can access firm context for routing and validation

## Test Cases

### Test 1: Password Setup Flow with Google Login

**Objective:** Verify that users with `mustSetPassword=true` cannot use Google login

**Steps:**
1. Create a new user via invite (they will have `mustSetPassword=true`)
2. Attempt Google login with that user's email
3. Verify redirect to `/set-password` page
4. Verify NO access/refresh tokens are issued
5. Complete password setup via invite link
6. Retry Google login
7. Verify successful login and redirect to `/:firmSlug/dashboard`

**Expected Results:**
- Step 3: User redirected to `/set-password?firmSlug={slug}&message=...`
- Step 4: No cookies or tokens set
- Step 7: User successfully logged in with tokens containing firm context

### Test 2: Firm Context in Password Login

**Objective:** Verify JWT tokens include firm context for password login

**Steps:**
1. Login via `/f/{firmSlug}/login` with xID and password
2. Decode the access token (use jwt.io)
3. Verify token includes: `userId`, `role`, `firmId`, `firmSlug`, `defaultClientId`
4. Call `/api/auth/profile`
5. Verify response includes `firmSlug` and `defaultClientId`

**Expected Results:**
- Token payload contains all firm context fields
- Profile response includes firm context
- firmSlug matches the firm used for login

### Test 3: Firm Context in Google Login

**Objective:** Verify JWT tokens include firm context for Google OAuth login

**Steps:**
1. Initiate Google login via `/api/auth/google?firmSlug={firmSlug}&flow=login`
2. Complete Google OAuth flow
3. Decode the access token from cookie
4. Verify token includes: `userId`, `role`, `firmId`, `firmSlug`, `defaultClientId`
5. Call `/api/auth/profile`
6. Verify response includes `firmSlug` and `defaultClientId`

**Expected Results:**
- Token payload contains all firm context fields
- Profile response includes firm context
- User redirected to `/:firmSlug/dashboard`

### Test 4: Token Refresh Preserves Firm Context

**Objective:** Verify refresh token endpoint preserves firm context

**Steps:**
1. Login with any method (password or Google)
2. Wait for token to expire or call `/api/auth/refresh` directly
3. Decode the new access token
4. Verify token includes: `userId`, `role`, `firmId`, `firmSlug`, `defaultClientId`

**Expected Results:**
- New token contains same firm context as original
- All firm fields present and correct

### Test 5: SuperAdmin Isolation

**Objective:** Verify SuperAdmin tokens have NO firm context

**Steps:**
1. Login as SuperAdmin via `/login`
2. Decode the access token
3. Verify token does NOT include: `firmId`, `firmSlug`, `defaultClientId`
4. Call `/api/auth/profile`
5. Verify response does NOT include firm fields

**Expected Results:**
- Token payload: `{ userId: 'SUPERADMIN', role: 'SuperAdmin', type: 'access', ... }`
- No firm context in token or profile
- SuperAdmin can access `/superadmin/*` routes

### Test 6: Firm Authorization in Frontend

**Objective:** Verify frontend validates firm access correctly

**Steps:**
1. Login as a user from Firm A
2. Note the firmSlug from user profile
3. Access dashboard at `/f/{firmSlugA}/dashboard`
4. Verify dashboard loads correctly
5. Attempt to access `/f/{firmSlugB}/dashboard` (different firm)
6. Verify "Access Denied" message

**Expected Results:**
- Step 4: Dashboard loads with user's firm data
- Step 6: Access denied, redirect to correct firm dashboard

### Test 7: Google OAuth State Preservation

**Objective:** Verify firm context is preserved through OAuth flow

**Steps:**
1. Start Google login from `/f/test-firm/login`
2. Click "Login with Google"
3. Complete Google authentication
4. Verify redirect to `/f/test-firm/dashboard`
5. Check token has correct firmSlug

**Expected Results:**
- Firm context preserved through OAuth state
- User returned to correct firm dashboard
- Token contains correct firmSlug

## Manual Testing Checklist

- [ ] Test 1: Password setup blocks Google login ✓
- [ ] Test 2: Password login includes firm context ✓
- [ ] Test 3: Google login includes firm context ✓
- [ ] Test 4: Token refresh preserves firm context ✓
- [ ] Test 5: SuperAdmin has no firm context ✓
- [ ] Test 6: Frontend validates firm access ✓
- [ ] Test 7: OAuth state preserves firm context ✓

## Edge Cases to Test

### Edge Case 1: User Without Firm (Should Not Exist)
- Attempt login for user without firmId
- Should fail with configuration error

### Edge Case 2: Deleted Firm
- Login as user whose firm was deleted/suspended
- Should receive appropriate error message

### Edge Case 3: Missing defaultClientId
- Login as Admin without defaultClientId
- Auto-repair should assign firm's defaultClientId

## Debugging Tips

### Decode JWT Token
```bash
# Using jwt.io or command line
echo "YOUR_TOKEN" | cut -d. -f2 | base64 -d | jq
```

### Check Token in Browser
1. Open Developer Tools
2. Go to Application > Cookies
3. Find `accessToken` cookie
4. Copy value and decode at jwt.io

### Verify Database State
```javascript
// Check user's firm context
db.users.findOne({ xID: "X000001" }, { firmId: 1, defaultClientId: 1, mustSetPassword: 1 })

// Check firm details
db.firms.findOne({ firmSlug: "test-firm" }, { name: 1, firmSlug: 1, defaultClientId: 1 })
```

## Known Issues & Notes

1. **Rate Limiting Warning**: CodeQL identified missing rate limiting on `/api/auth/profile` - pre-existing issue, not introduced by this PR

2. **Token Expiry**: Access tokens expire in 15 minutes. Use refresh tokens for longer sessions.

3. **SuperAdmin**: SuperAdmin can only use password login, never Google OAuth

## Success Criteria

All tests pass with expected results:
- ✓ Google login blocked until password is set
- ✓ JWT tokens include firm context (firmId, firmSlug, defaultClientId)
- ✓ Token refresh preserves firm context
- ✓ Profile endpoint returns firm context
- ✓ SuperAdmin tokens have no firm context
- ✓ Frontend validates firm access correctly
- ✓ No breaking changes to existing auth flows

## Rollback Plan

If issues are discovered in production:
1. Revert this PR
2. JWT tokens will revert to previous format (firmId only)
3. Google login will not enforce mustSetPassword (security issue)
4. Frontend may show "Access Denied" for some users
