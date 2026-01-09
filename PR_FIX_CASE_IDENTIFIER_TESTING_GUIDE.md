# PR: Fix Case Identifier & Assignment - Testing Guide

## Overview
This PR fixes critical issues with case identification, assignment, routing, and dashboard consistency.

## Test Scenarios

### 1. Test Case Navigation (CRITICAL FIX)

**Verify caseId is used for all navigation:**

1. Go to **My Worklist** (`/worklist`)
   - Click on any case in the table
   - ✅ Verify URL is `/cases/CASE-YYYYMMDD-XXXXX` (caseId format)
   - ❌ Should NOT be `/cases/caseYYYYMMDDxxxxx` (caseName format)

2. Go to **Dashboard** (`/dashboard`)
   - Click on any recent case in the table
   - ✅ Verify URL is `/cases/CASE-YYYYMMDD-XXXXX`
   - ❌ Should NOT be `/cases/caseYYYYMMDDxxxxx`

3. Go to **Admin Reports** → **Detailed Reports** (`/admin/reports/detailed`)
   - Click on any case in the table
   - ✅ Verify URL is `/cases/CASE-YYYYMMDD-XXXXX`
   - ❌ Should NOT be `/cases/caseYYYYMMDDxxxxx`

4. Go to **Global Worklist** (`/global-worklist`)
   - Click "View" on any case
   - ✅ Verify URL is `/cases/CASE-YYYYMMDD-XXXXX`

**Expected Result**: All case navigation uses caseId format (CASE-YYYYMMDD-XXXXX)

---

### 2. Test Atomic Case Pull Assignment

**Verify pulling a case assigns it atomically with all required fields:**

1. Go to **Global Worklist** (`/global-worklist`)
2. Note the case ID (e.g., `CASE-20260109-00001`)
3. Click **Pull** button on an unassigned case
4. Confirm the pull action

**Expected Results:**
- ✅ Case disappears from Global Worklist
- ✅ Success message appears
- ✅ Go to **My Worklist** - case appears there
- ✅ Go to **Dashboard** - "My Open Cases" count increments by 1
- ✅ Click on the case to open it
- ✅ Case opens in EDIT mode (not view-only)
- ✅ Case status is "OPEN" (not "UNASSIGNED")

**Database Verification** (Admin only):
Query the case in MongoDB to verify all fields were updated atomically:
```javascript
db.cases.findOne({ caseId: "CASE-20260109-00001" })
```

Should show:
- `assignedTo`: Your xID (e.g., "X123456")
- `status`: "OPEN"
- `queueType`: "PERSONAL"
- `assignedAt`: Recent timestamp
- `lastActionByXID`: Your xID (e.g., "X123456")
- `lastActionAt`: Recent timestamp (same as assignedAt)

---

### 3. Test Case Fetch & View Mode

**Verify cases can be viewed by anyone but edited only by assignee:**

**Test 3A: View Unassigned Case**
1. Go to **Global Worklist**
2. Copy a case ID from an unassigned case
3. Manually navigate to `/cases/CASE-20260109-00001` (paste in browser)
4. ✅ Case should load successfully (not "Case not found")
5. ✅ Should show "View-Only Mode" badge
6. ✅ Should show alert: "This case is not assigned to you"

**Test 3B: View Case Assigned to Another User**
1. Have User A pull a case
2. Log in as User B
3. Navigate to the same case URL
4. ✅ Case should load successfully
5. ✅ Should show "View-Only Mode" badge
6. ✅ Should show alert: "This case is not assigned to you"
7. ✅ User B can add comments and attachments
8. ❌ User B cannot edit case details or change status

**Test 3C: View Own Assigned Case**
1. Pull a case from Global Worklist
2. Open the case
3. ✅ Case should load in EDIT mode
4. ❌ Should NOT show "View-Only Mode" badge
5. ✅ Can edit all case details

---

### 4. Test Worklist & Dashboard Consistency

**Verify My Worklist and Dashboard "My Open Cases" show same data:**

1. Pull 3 cases from Global Worklist
2. Go to **Dashboard** → Note "My Open Cases" count (should be 3)
3. Go to **My Worklist**
4. ✅ Worklist should show exactly 3 cases
5. ✅ Dashboard count === Worklist case count

**Test Status Filtering:**
1. Open one of your cases
2. Change status to "PENDED" (if available) or "RESOLVED"
3. Go back to **My Worklist**
4. ✅ Case should disappear from worklist (only OPEN cases shown)
5. Go to **Dashboard**
6. ✅ "My Open Cases" count decremented by 1
7. ✅ If status was PENDED, "My Pending Cases" incremented by 1

---

### 5. Test Post-Create Workflow

**Verify case creation doesn't redirect to case detail:**

1. Go to **Create Case** (`/cases/create`)
2. Fill in all required fields
3. Click **Submit**

**Expected Results:**
- ✅ Success message appears: "Case CASE-YYYYMMDD-XXXXX created and moved to Global Worklist"
- ✅ Two action buttons shown:
  - "Go to Global Worklist" - navigates to `/global-worklist`
  - "Create Another Case" - hides message and keeps you on form
- ❌ Should NOT auto-redirect to `/cases/CASE-YYYYMMDD-XXXXX`
- ✅ Form resets to allow creating another case

**Test Actions:**
1. Click "Go to Global Worklist"
   - ✅ Should navigate to Global Worklist
   - ✅ Created case should appear in the list

2. Create another case, click "Create Another Case"
   - ✅ Success message disappears
   - ✅ Form is reset
   - ✅ Can create another case immediately

---

### 6. Test Global Worklist Query

**Verify Global Worklist only shows UNASSIGNED cases:**

1. Go to **Global Worklist**
2. Note all cases shown have status badge "UNASSIGNED"
3. Pull one case (assigns it to you)
4. ✅ Case disappears from Global Worklist
5. Change a case status from OPEN to UNASSIGNED (if possible via Admin)
6. ✅ Case should appear in Global Worklist

---

### 7. Test Bulk Pull

**Verify bulk pull works correctly:**

1. Go to **Global Worklist**
2. Select 3 cases using checkboxes
3. Click "Pull Cases (3)" button
4. Confirm the action

**Expected Results:**
- ✅ All 3 cases disappear from Global Worklist
- ✅ Success message shows: "All 3 cases pulled successfully"
- ✅ Go to **My Worklist** - all 3 cases appear
- ✅ Go to **Dashboard** - "My Open Cases" count increased by 3

**Test Partial Success:**
1. Select 3 cases
2. Have another user pull one of those cases (race condition)
3. Try to bulk pull
4. ✅ Should show: "2 of 3 cases pulled. Some were already assigned."

---

## Acceptance Criteria Checklist

All criteria from the problem statement:

- [x] **Pulling a case:**
  - [x] Removes it from Global Worklist
  - [x] Adds it to My Worklist
  - [x] Increments Dashboard → My Open Cases
  - [x] Opens in EDIT mode
- [x] **URLs work consistently everywhere** (all use caseId)
- [x] **No case remains UNASSIGNED after pull** (status changes to OPEN)
- [x] **No dashboard count mismatch** (uses same query as worklist)
- [x] **No "Case not found" for valid cases** (fetch by caseId only)
- [x] **No email-based ownership logic** (all use xID)

---

## Edge Cases to Test

### Edge Case 1: Concurrent Pull
- Two users try to pull the same case simultaneously
- ✅ Only one should succeed
- ✅ Other should get error: "Case is no longer available (already assigned)"

### Edge Case 2: Direct URL Access
- User manually types `/cases/INVALID-CASE-ID`
- ✅ Should show "Case not found"
- User types `/cases/CASE-20260109-00001` (valid, unassigned)
- ✅ Should load in view-only mode

### Edge Case 3: Status Transitions
- Pull a case (status → OPEN)
- Change to PENDED
- ✅ Disappears from My Worklist
- ✅ Appears in "My Pending Cases" dashboard
- Change back to OPEN
- ✅ Reappears in My Worklist

---

## Rollback Plan

If issues are found:

1. Frontend navigation issues:
   - Revert changes to WorklistPage.jsx, DashboardPage.jsx, DetailedReports.jsx, ReportsTable.jsx

2. Assignment issues:
   - Revert changes to caseAssignment.service.js

3. Documentation only:
   - Changes to Case.model.js are documentation only, safe to keep

---

## Notes for QA

- Test with at least 2 different users to verify view-only mode
- Test bulk operations with 10+ cases
- Verify dashboard counts match across all views
- Check browser console for any errors during navigation
- Verify no cases are "stuck" in UNASSIGNED status after pull
