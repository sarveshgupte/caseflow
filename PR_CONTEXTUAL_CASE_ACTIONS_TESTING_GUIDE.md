# Manual Testing Guide: Contextual Case Actions

## 🎯 Overview

This guide provides step-by-step instructions for manually testing the new contextual case action buttons in the Case Detail page.

## 🔧 Prerequisites

1. Application running locally or on test environment
2. Test database with sample cases
3. Two test accounts:
   - **Admin account** (role: "Admin")
   - **Employee account** (role: "Employee")

## 📋 Test Scenarios

### Scenario 1: Pull Case - Non-Admin User

**Setup:**
1. Login as **Employee** user
2. Navigate to Global Worklist (`/global-worklist`)
3. Verify there's at least one unassigned case

**Steps:**
1. Click "View" on any unassigned case
2. **Verify:** Page shows case in View-Only Mode
3. **Verify:** "View-Only Mode" badge is visible (yellow/warning color)
4. **Verify:** "Pull Case" button is visible (blue/primary color)
5. **Verify:** Status badge shows "UNASSIGNED"
6. Click "Pull Case" button
7. **Verify:** Confirmation dialog appears: "Pull this case? This will assign it to you."
8. Click "OK" to confirm
9. **Verify:** Success message appears: "✅ Case pulled and assigned to you"
10. **Verify:** Page reloads and shows updated state:
    - "View-Only Mode" badge disappears
    - "Pull Case" button disappears
    - Status changes from "UNASSIGNED" to "OPEN"
    - Case now appears in "My Worklist"

**Expected Result:** ✅ Case successfully pulled and assigned to user

---

### Scenario 2: Pull Case - Admin User

**Setup:**
1. Login as **Admin** user
2. Navigate to Global Worklist
3. Verify there's at least one unassigned case

**Steps:**
1. Click "View" on any unassigned case
2. **Verify:** "Pull Case" button is visible (blue)
3. **Verify:** "Move to Global Worklist" button is also visible (orange border)
4. Click "Pull Case" button
5. Confirm the action
6. **Verify:** Case pulled successfully (same as Scenario 1)

**Expected Result:** ✅ Admin can pull cases just like employees

---

### Scenario 3: Move to Global Worklist - Admin Only

**Setup:**
1. Login as **Admin** user
2. Ensure you have an assigned case (assigned to yourself or another user)
3. Navigate to the case detail page

**Steps:**
1. View the assigned case
2. **Verify:** "Move to Global Worklist" button is visible (orange border)
3. Click "Move to Global Worklist" button
4. **Verify:** Confirmation dialog appears: "This will remove the current assignment and move the case to the Global Worklist. Continue?"
5. Click "OK" to confirm
6. **Verify:** Success message appears: "✅ Case moved to Global Worklist"
7. **Verify:** Page reloads and shows updated state:
    - Status changes to "UNASSIGNED"
    - "View-Only Mode" badge appears
    - Case now appears in Global Worklist
    - "Assigned To" shows "Unassigned"

**Expected Result:** ✅ Case successfully moved to Global Worklist

---

### Scenario 4: Button Visibility - Non-Admin Viewing Assigned Case

**Setup:**
1. Login as **Employee** user
2. Navigate to a case assigned to another user

**Steps:**
1. View the case detail page
2. **Verify:** "View-Only Mode" badge is visible
3. **Verify:** "Pull Case" button is NOT visible
4. **Verify:** "Move to Global Worklist" button is NOT visible
5. **Verify:** Only status badges are shown

**Expected Result:** ✅ No action buttons visible (read-only access only)

---

### Scenario 5: Own Case - No Action Buttons

**Setup:**
1. Login as any user (admin or employee)
2. Navigate to a case assigned to the current user

**Steps:**
1. View the case detail page
2. **Verify:** "View-Only Mode" badge is NOT visible
3. **Verify:** "Pull Case" button is NOT visible
4. **Verify:** "Move to Global Worklist" button is NOT visible (even for admin)
5. **Verify:** Normal edit capabilities are available

**Expected Result:** ✅ No view-only mode, normal case editing enabled

---

### Scenario 6: Error Handling - Pull Already Assigned Case

**Setup:**
1. Open two browser windows/tabs
2. Login as different users in each
3. Both navigate to same unassigned case

**Steps:**
1. In Window 1: View unassigned case, see "Pull Case" button
2. In Window 2: View same case, see "Pull Case" button
3. In Window 1: Click "Pull Case" and confirm
4. **Verify:** Case pulled successfully in Window 1
5. In Window 2: Click "Pull Case" and confirm
6. **Verify:** Error message appears (case already assigned)
7. **Verify:** Page reloads and shows case is no longer unassigned

**Expected Result:** ✅ Proper error handling for race condition

---

### Scenario 7: Authorization - Non-Admin Cannot Move to Global

**Setup:**
1. Login as **Employee** user
2. Note the user's authentication token (from browser dev tools)

**Steps:**
1. Use API testing tool (Postman, curl, etc.)
2. Make POST request to `/api/cases/:caseId/unassign`
3. Include authentication token in Authorization header
4. **Verify:** Response is 403 Forbidden
5. **Verify:** Response message: "Forbidden - Only admins can move cases to global worklist"

**Expected Result:** ✅ Backend enforces admin-only access

---

### Scenario 8: Button State During Operations

**Setup:**
1. Login as any user
2. Navigate to unassigned case (or assigned case as admin)

**Steps:**
1. Click "Pull Case" (or "Move to Global") button
2. **Verify:** Button text changes to "Pulling..." (or "Moving...")
3. **Verify:** Button becomes disabled (greyed out)
4. **Verify:** Cannot click button again while operation in progress
5. Wait for operation to complete
6. **Verify:** Button state returns to normal (or disappears if action successful)

**Expected Result:** ✅ Button disabled during operations to prevent double-clicks

---

## 🎨 Visual Verification Checklist

### Button Styling
- [ ] "Pull Case" button: Blue/primary color, prominent
- [ ] "Move to Global Worklist" button: Orange border, secondary style
- [ ] Buttons have proper spacing (8px gap)
- [ ] Buttons aligned with badges in header

### Badge Styling
- [ ] "View-Only Mode" badge: Yellow background, brown text
- [ ] Status badges: Appropriate colors based on status
- [ ] Badges have rounded corners and proper padding

### Responsive Design
- [ ] Buttons wrap properly on narrow screens
- [ ] Button text remains readable at all sizes
- [ ] Header layout doesn't break with multiple buttons

---

## 🔍 Edge Cases to Test

### 1. Case Status Transitions
- [ ] Pull case → Case status changes to OPEN
- [ ] Move to global → Case status changes to UNASSIGNED
- [ ] Verify queueType updates correctly (GLOBAL vs PERSONAL)

### 2. Concurrent Access
- [ ] Two users viewing same case simultaneously
- [ ] One pulls while other is viewing
- [ ] UI updates correctly on refresh

### 3. Network Errors
- [ ] What happens if request fails?
- [ ] Error message displayed to user?
- [ ] Button returns to enabled state?

### 4. Audit Logs
- [ ] Check database after actions
- [ ] Verify CaseAudit entries created
- [ ] Verify CaseHistory entries created
- [ ] Verify xID attribution is correct

---

## 📊 Test Results Template

```
Test Date: _____________
Tester: _____________
Environment: _____________

| Scenario | Status | Notes |
|----------|--------|-------|
| 1. Pull Case (Employee) | ☐ Pass ☐ Fail | |
| 2. Pull Case (Admin) | ☐ Pass ☐ Fail | |
| 3. Move to Global (Admin) | ☐ Pass ☐ Fail | |
| 4. No Buttons (Employee/Assigned) | ☐ Pass ☐ Fail | |
| 5. No Buttons (Own Case) | ☐ Pass ☐ Fail | |
| 6. Error Handling | ☐ Pass ☐ Fail | |
| 7. Authorization | ☐ Pass ☐ Fail | |
| 8. Button States | ☐ Pass ☐ Fail | |

Overall Result: ☐ All Pass ☐ Some Failures

Issues Found:
1. _______________________________
2. _______________________________
```

---

## 🚀 Quick Test Script

For rapid smoke testing, run through this quick script:

```bash
# As Employee
1. Login as employee
2. Go to Global Worklist
3. Pull a case → Should work ✓
4. View assigned case (not yours) → No buttons ✓

# As Admin
5. Login as admin
6. View unassigned case → Both buttons visible ✓
7. Pull case → Should work ✓
8. View assigned case (not yours) → Move to Global visible ✓
9. Move case to global → Should work ✓
10. Verify case appears in Global Worklist ✓

Total time: ~5 minutes
```

---

## 📝 Notes

- Test in different browsers (Chrome, Firefox, Safari)
- Test on different screen sizes (desktop, tablet, mobile)
- Test with different data states (empty worklist, many cases, etc.)
- Verify console has no JavaScript errors
- Check network tab for proper API calls

---

## ✅ Sign-off

Once all scenarios pass:

```
Tested by: _______________________
Date: _______________________
Environment: Production-ready ☐ Yes ☐ No
Approved for deployment: ☐ Yes ☐ No

Signature: _______________________
```
