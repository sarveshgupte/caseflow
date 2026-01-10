# Testing Guide - Firm-Scoped Routing

## Overview
This guide provides step-by-step instructions for testing the firm-scoped routing implementation.

## Prerequisites

### Test Data Required
1. **Test Firm:**
   - Firm Slug: `test-firm` (or your test firm's slug)
   - Firm Name: Test Legal Firm

2. **Test Users:**
   - User A: Regular user in test-firm
   - User B (Optional): Regular user in different firm (for cross-firm testing)
   - Admin: Admin user in test-firm

3. **New User:**
   - User with pending password setup (for first-time flow)

## Test Scenarios

### 1. Firm-Specific Login Flow

#### Test 1.1: Login via Firm URL
**Objective:** Verify login preserves firm context

**Steps:**
1. Navigate to `/f/test-firm/login`
2. Enter valid credentials
3. Click "Sign In"

**Expected Result:**
- ✅ Redirected to `/test-firm/dashboard`
- ✅ URL shows firm slug
- ✅ Dashboard loads correctly

**Pass/Fail:** ______

---

#### Test 1.2: Login via Generic URL
**Objective:** Verify generic login extracts firm from user data

**Steps:**
1. Navigate to `/login`
2. Enter valid credentials for user in test-firm
3. Click "Sign In"

**Expected Result:**
- ✅ Redirected to `/test-firm/dashboard`
- ✅ Firm slug appears in URL
- ✅ Dashboard loads correctly

**Pass/Fail:** ______

---

### 2. First-Time Password Setup Flow

#### Test 2.1: Password Setup Redirect
**Objective:** Verify first-time setup redirects to firm dashboard

**Steps:**
1. Click password setup link from invitation email
2. URL should be `/set-password?token=...`
3. Enter new password (meeting requirements)
4. Confirm password
5. Click "Set Password"

**Expected Result:**
- ✅ Success message displayed
- ✅ Redirected to `/test-firm/dashboard` (or login page)
- ✅ Can login with new password
- ✅ Dashboard loads at firm-scoped URL

**Pass/Fail:** ______

---

### 3. Navigation Preservation

#### Test 3.1: Navigation Links
**Objective:** Verify all navigation links preserve firm context

**Steps:**
1. Login to test-firm
2. Click each navigation link:
   - Dashboard
   - Workbasket
   - My Worklist
   - Create Case
   - Admin (if admin user)
   - Profile

**Expected Result:**
- ✅ All URLs maintain `/test-firm/` prefix
- ✅ Pages load correctly
- ✅ No 404 errors

**Pass/Fail:** ______

---

#### Test 3.2: Deep Links
**Objective:** Verify deep linking maintains firm context

**Steps:**
1. Login to test-firm
2. Navigate to a case: `/test-firm/cases/CASE001`
3. Copy URL
4. Open new tab
5. Paste URL and navigate

**Expected Result:**
- ✅ URL maintains `/test-firm/cases/CASE001`
- ✅ Case loads correctly
- ✅ Navigation works

**Pass/Fail:** ______

---

### 4. Refresh Behavior

#### Test 4.1: Page Refresh
**Objective:** Verify refresh maintains firm context

**Steps:**
1. Login to test-firm
2. Navigate to `/test-firm/dashboard`
3. Press F5 or browser refresh button
4. Check URL

**Expected Result:**
- ✅ URL still shows `/test-firm/dashboard`
- ✅ Dashboard reloads correctly
- ✅ User remains authenticated

**Pass/Fail:** ______

---

#### Test 4.2: Hard Refresh
**Objective:** Verify hard refresh maintains firm context

**Steps:**
1. Login to test-firm
2. Navigate to `/test-firm/admin/reports`
3. Press Ctrl+F5 (Cmd+Shift+R on Mac) for hard refresh
4. Check URL

**Expected Result:**
- ✅ URL still shows `/test-firm/admin/reports`
- ✅ Page reloads correctly
- ✅ User remains authenticated

**Pass/Fail:** ______

---

### 5. Logout Flow

#### Test 5.1: Logout Redirect
**Objective:** Verify logout redirects to firm login

**Steps:**
1. Login to test-firm
2. Navigate to any page
3. Click "Logout" button
4. Check URL

**Expected Result:**
- ✅ Redirected to `/f/test-firm/login`
- ✅ Login page shows firm name
- ✅ Session cleared

**Pass/Fail:** ______

---

#### Test 5.2: Post-Logout Access
**Objective:** Verify protected routes redirect after logout

**Steps:**
1. After logout, manually navigate to `/test-firm/dashboard`
2. Check URL and page content

**Expected Result:**
- ✅ Redirected to `/f/test-firm/login`
- ✅ Dashboard not accessible
- ✅ Login prompt shown

**Pass/Fail:** ______

---

### 6. Cross-Firm Access Prevention

#### Test 6.1: URL Manipulation
**Objective:** Verify users cannot access other firms via URL

**Prerequisites:** Need User A in firm-a and User B in firm-b

**Steps:**
1. Login as User A (belongs to firm-a)
2. Verify URL is `/firm-a/dashboard`
3. Manually change URL to `/firm-b/dashboard`
4. Press Enter

**Expected Result:**
- ✅ Access denied message displayed
- ✅ Button to return to own dashboard
- ✅ No firm-b data visible

**Pass/Fail:** ______

---

#### Test 6.2: Firm Validation
**Objective:** Verify invalid firm slug shows error

**Steps:**
1. Logout completely
2. Navigate to `/f/invalid-firm-999/login`

**Expected Result:**
- ✅ Error message: "Firm not found"
- ✅ Helpful text for user
- ✅ No login form shown

**Pass/Fail:** ______

---

### 7. Dashboard KPI Navigation

#### Test 7.1: KPI Card Navigation
**Objective:** Verify dashboard KPI cards navigate with firm context

**Steps:**
1. Login to test-firm as regular user
2. On dashboard, click "My Open Cases" card
3. Check URL

**Expected Result:**
- ✅ URL is `/test-firm/my-worklist?status=OPEN`
- ✅ Correct filtered list shown

**Pass/Fail:** ______

---

#### Test 7.2: Admin KPI Navigation
**Objective:** Verify admin KPI cards navigate with firm context

**Steps:**
1. Login to test-firm as admin
2. On dashboard, click "Pending Approvals" card
3. Check URL

**Expected Result:**
- ✅ URL is `/test-firm/cases?approvalStatus=PENDING`
- ✅ Correct filtered list shown

**Pass/Fail:** ______

---

### 8. Case Management Flows

#### Test 8.1: Create Case Flow
**Objective:** Verify case creation redirects with firm context

**Steps:**
1. Login to test-firm
2. Navigate to `/test-firm/cases/create`
3. Fill in case details
4. Submit form
5. Click "View Case" on success message

**Expected Result:**
- ✅ Redirected to `/test-firm/cases/CASE123`
- ✅ Case details load correctly

**Pass/Fail:** ______

---

#### Test 8.2: Case Detail Navigation
**Objective:** Verify case detail links maintain firm context

**Steps:**
1. Login to test-firm
2. Go to worklist
3. Click on any case
4. Check URL

**Expected Result:**
- ✅ URL is `/test-firm/cases/CASE123`
- ✅ Case details load correctly
- ✅ Back navigation maintains context

**Pass/Fail:** ______

---

### 9. Admin Panel Navigation

#### Test 9.1: Admin Reports Navigation
**Objective:** Verify admin reports maintain firm context

**Steps:**
1. Login to test-firm as admin
2. Navigate to `/test-firm/admin`
3. Click "Reports & MIS" button
4. Check URL

**Expected Result:**
- ✅ URL is `/test-firm/admin/reports`
- ✅ Reports page loads
- ✅ Firm context maintained

**Pass/Fail:** ______

---

#### Test 9.2: Detailed Reports Navigation
**Objective:** Verify detailed reports navigation

**Steps:**
1. From reports dashboard
2. Click "View Detailed Reports"
3. Check URL
4. Click on a case in the table

**Expected Result:**
- ✅ URL is `/test-firm/admin/reports/detailed`
- ✅ Case click goes to `/test-firm/cases/CASE123`
- ✅ All navigation maintains context

**Pass/Fail:** ______

---

### 10. Browser Back/Forward

#### Test 10.1: Browser Back Button
**Objective:** Verify back button maintains firm context

**Steps:**
1. Login to test-firm
2. Navigate: Dashboard → Worklist → Case Detail
3. Click browser back button twice

**Expected Result:**
- ✅ Each back maintains `/test-firm/` prefix
- ✅ Pages load correctly
- ✅ No broken navigation

**Pass/Fail:** ______

---

#### Test 10.2: Browser Forward Button
**Objective:** Verify forward button maintains firm context

**Steps:**
1. After Test 10.1, click browser forward button twice

**Expected Result:**
- ✅ Navigation forward works correctly
- ✅ URLs maintain firm context
- ✅ Pages load correctly

**Pass/Fail:** ______

---

### 11. SuperAdmin Routes (Non-Scoped)

#### Test 11.1: SuperAdmin Login
**Objective:** Verify superadmin routes don't require firm slug

**Steps:**
1. Login as superadmin at `/login`
2. Check redirect URL

**Expected Result:**
- ✅ Redirected to `/superadmin` (NO firm slug)
- ✅ Platform dashboard loads
- ✅ Firm management accessible

**Pass/Fail:** ______

---

#### Test 11.2: SuperAdmin Isolation
**Objective:** Verify superadmin cannot access firm routes

**Steps:**
1. Login as superadmin
2. Try to navigate to `/test-firm/dashboard`

**Expected Result:**
- ✅ Redirected back to `/superadmin`
- ✅ Cannot access firm routes

**Pass/Fail:** ______

---

## Edge Cases

### Edge Case 1: Multiple Tabs
**Steps:**
1. Login in Tab 1
2. Open Tab 2 with same firm URL
3. Navigate in both tabs
4. Logout in Tab 1
5. Try to navigate in Tab 2

**Expected Result:**
- ✅ Both tabs work independently
- ✅ Tab 2 redirects to login after Tab 1 logout

**Pass/Fail:** ______

---

### Edge Case 2: Bookmarks
**Steps:**
1. Login to test-firm
2. Navigate to `/test-firm/cases/CASE123`
3. Bookmark the page
4. Logout
5. Use bookmark to navigate

**Expected Result:**
- ✅ Redirected to `/f/test-firm/login`
- ✅ After login, can access bookmarked page

**Pass/Fail:** ______

---

### Edge Case 3: Direct URL Access
**Steps:**
1. Not logged in
2. Enter URL: `/test-firm/admin/reports` directly
3. Press Enter

**Expected Result:**
- ✅ Redirected to `/f/test-firm/login`
- ✅ After login, redirected to requested page or dashboard

**Pass/Fail:** ______

---

## Performance Testing

### Performance 1: Navigation Speed
**Objective:** Verify navigation is not slower with firm routing

**Steps:**
1. Login to test-firm
2. Navigate between pages multiple times
3. Measure subjective response time

**Expected Result:**
- ✅ Navigation feels responsive
- ✅ No noticeable delays
- ✅ Page loads are fast

**Pass/Fail:** ______

---

## Mobile Testing (Optional)

### Mobile 1: Responsive Firm URLs
**Steps:**
1. Access on mobile device
2. Login via firm URL
3. Navigate through pages
4. Check URL bar (if visible)

**Expected Result:**
- ✅ URLs work on mobile
- ✅ Firm context maintained
- ✅ Navigation works

**Pass/Fail:** ______

---

## Automated Testing Checklist

### Unit Tests (Future)
- [ ] FirmLayout validation logic
- [ ] ProtectedRoute authentication and role checks
- [ ] URL-based firmSlug extraction

### Integration Tests (Future)
- [ ] Router configuration
- [ ] Route matching
- [ ] Redirect flows

### E2E Tests (Future)
- [ ] Complete login flow
- [ ] Navigation preservation
- [ ] Cross-firm access prevention

---

## Test Summary

### Total Tests: 25
### Passed: _____ / 25
### Failed: _____ / 25
### Blocked: _____ / 25

### Critical Issues Found:
1. _______________________________________________
2. _______________________________________________
3. _______________________________________________

### Minor Issues Found:
1. _______________________________________________
2. _______________________________________________
3. _______________________________________________

### Recommendations:
1. _______________________________________________
2. _______________________________________________
3. _______________________________________________

---

## Sign-Off

**Tester Name:** _______________________________________________
**Date:** _______________________________________________
**Environment:** _______________________________________________
**Browser:** _______________________________________________
**OS:** _______________________________________________

**Overall Assessment:** 
- [ ] Ready for Production
- [ ] Needs Minor Fixes
- [ ] Needs Major Fixes
- [ ] Not Ready

**Comments:**
________________________________________________________________
________________________________________________________________
________________________________________________________________
