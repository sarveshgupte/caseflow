# Testing Guide: Unified Pull Logic PR

## 🎯 Testing Objective

Verify that both single case pull and bulk case pull operations:
1. Work without errors
2. Behave identically
3. Assign cases to the correct user (via xID)
4. Make cases appear in My Worklist immediately
5. Update Dashboard counts correctly

---

## 📋 Prerequisites

### Required Setup
- [ ] Backend server running and connected to MongoDB
- [ ] Frontend UI running (or built and served)
- [ ] At least one user account created with xID (e.g., X000001)
- [ ] At least 3 UNASSIGNED cases in the database

### Test User Credentials
- **xID:** X000001 (or your test user's xID)
- **Password:** (your test password)

---

## 🧪 Test Suite

### Test 1: Single Case Pull (Happy Path)

**Objective:** Verify single case can be pulled successfully

**Steps:**
1. Log in with test user (xID: X000001)
2. Navigate to **Global Worklist** page
3. Note the number of cases displayed (e.g., 5 cases)
4. Click **Pull** button on the first case row
5. Confirm the dialog that appears
6. Wait for success message
7. Navigate to **My Worklist** page
8. Navigate to **Dashboard** page

**Expected Results:**
- ✅ No error message appears
- ✅ Success message: "Case pulled successfully!"
- ✅ Global Worklist shows 4 cases (one less)
- ✅ My Worklist shows the pulled case
- ✅ Dashboard "My Open Cases" count increased by 1
- ✅ Case in database has:
  - `assignedToXID: "X000001"`
  - `status: "OPEN"`
  - `queueType: "PERSONAL"`

---

### Test 2: Bulk Case Pull (Happy Path)

**Objective:** Verify multiple cases can be pulled at once

**Steps:**
1. Ensure you're logged in with test user (xID: X000001)
2. Navigate to **Global Worklist** page
3. Note the current count (e.g., 4 cases remaining)
4. Check the **Select All** checkbox (or select 3 individual cases)
5. Note the button shows "Pull Cases (3)"
6. Click the **Pull Cases (3)** button
7. Confirm the dialog
8. Wait for success message
9. Navigate to **My Worklist** page
10. Navigate to **Dashboard** page

**Expected Results:**
- ✅ No error message appears
- ✅ Success message: "All 3 cases pulled successfully!"
- ✅ Global Worklist shows 1 case (or 0 if all pulled)
- ✅ My Worklist shows all 3 newly pulled cases
- ✅ Dashboard "My Open Cases" count increased by 3
- ✅ All 3 cases in database have:
  - `assignedToXID: "X000001"`
  - `status: "OPEN"`
  - `queueType: "PERSONAL"`

---

### Test 3: Pull with No Authentication

**Objective:** Verify authentication is required

**Steps:**
1. Log out (or open incognito window)
2. Try to access Global Worklist
   
**Expected Results:**
- ✅ Redirected to login page
- ✅ Cannot access Global Worklist without authentication

---

### Test 4: Race Condition (Two Users Pull Same Case)

**Objective:** Verify only one user can pull a case

**Setup:**
- Two browser windows/tabs
- User A logged in as X000001
- User B logged in as X000002

**Steps:**
1. Both users navigate to Global Worklist
2. Both users see the same case (e.g., case2026010900001)
3. User A clicks **Pull** on the case → confirms
4. Wait for success message
5. User B clicks **Pull** on the SAME case → confirms

**Expected Results:**
- ✅ User A: "Case pulled successfully!"
- ✅ User B: "Case is no longer available (already assigned)"
- ✅ Case appears only in User A's worklist
- ✅ Case disappears from User B's Global Worklist after refresh
- ✅ Case in database assigned to User A only

---

### Test 5: Pull Already Assigned Case (Edge Case)

**Objective:** Verify system handles already-assigned cases gracefully

**Steps:**
1. Log in as User A (X000001)
2. Pull a case from Global Worklist
3. Without refreshing, try to pull the SAME case again

**Expected Results:**
- ✅ Error message: "Case is no longer available (already assigned)"
- ✅ No duplicate in My Worklist
- ✅ Case still assigned to original user

---

### Test 6: Bulk Pull with Some Already Assigned

**Objective:** Verify partial success handling

**Setup:**
- Have 3 UNASSIGNED cases
- User A (X000001) pulls case 1
- User B (X000002) stays on Global Worklist (doesn't refresh)

**Steps:**
1. User B selects 3 cases (including the one User A just pulled)
2. User B clicks "Pull Cases (3)"
3. Confirms dialog

**Expected Results:**
- ✅ Message: "2 of 3 cases pulled. Some were already assigned."
- ✅ User B's worklist shows only the 2 newly assigned cases
- ✅ Case 1 remains assigned to User A
- ✅ No errors or crashes

---

### Test 7: Invalid Case ID (Security Test)

**Objective:** Verify input validation

**Method:** Use browser dev tools to modify request

**Steps:**
1. Open browser Developer Tools (F12)
2. Go to Global Worklist
3. Click Pull on a case
4. In Network tab, find the POST request to `/api/cases/{caseId}/pull`
5. Right-click → Copy → Copy as fetch
6. Paste in Console and modify the URL to use invalid case ID:
   ```javascript
   fetch("http://localhost:3000/api/cases/invalid-id-123/pull", {
     method: "POST",
     headers: { /* auth token */ }
   })
   ```

**Expected Results:**
- ✅ Response: 404 Not Found or 400 Bad Request
- ✅ No case is assigned
- ✅ Error message returned

---

### Test 8: No Auth Token (Security Test)

**Objective:** Verify authentication is enforced

**Method:** Use browser dev tools to make unauthorized request

**Steps:**
1. Open browser Developer Tools (F12)
2. In Console, run:
   ```javascript
   fetch("http://localhost:3000/api/cases/case2026010900001/pull", {
     method: "POST",
     headers: { "Content-Type": "application/json" }
     // Note: No Authorization header
   })
   .then(r => r.json())
   .then(console.log)
   ```

**Expected Results:**
- ✅ Response: 401 Unauthorized
- ✅ Message: "Authentication required"
- ✅ No case is assigned

---

### Test 9: Dashboard Count Accuracy

**Objective:** Verify dashboard reflects actual worklist count

**Steps:**
1. Log in as test user
2. Navigate to Dashboard
3. Note "My Open Cases" count (e.g., 2)
4. Navigate to My Worklist
5. Count cases manually (should be 2)
6. Pull 1 more case from Global Worklist
7. Return to Dashboard

**Expected Results:**
- ✅ Dashboard "My Open Cases" count matches My Worklist count before pull
- ✅ After pull, Dashboard count increased by exactly 1
- ✅ Dashboard count still matches My Worklist count after pull

---

### Test 10: Worklist Visibility After Pull

**Objective:** Verify case immediately visible after pull (no manual refresh)

**Note:** This requires JavaScript to auto-refresh, which the code does via `loadGlobalWorklist()`

**Steps:**
1. Navigate to Global Worklist
2. Count cases (e.g., 5 cases)
3. Pull 1 case (single pull)
4. **DO NOT manually refresh the page**
5. Observe the Global Worklist table

**Expected Results:**
- ✅ Case disappears from Global Worklist automatically (code calls `loadGlobalWorklist()`)
- ✅ Count updates (e.g., now shows 4 cases)
- ✅ No manual refresh needed

**Alternative (if auto-refresh fails):**
- Navigate to My Worklist
- Pulled case should appear
- Dashboard count should update

---

## 🔍 Database Verification Queries

### Check Case Assignment
```javascript
// In MongoDB shell or Compass
db.cases.findOne({ caseId: "case2026010900001" })

// Expected output:
{
  caseId: "case2026010900001",
  assignedToXID: "X000001",     // ✅ Should be user's xID
  status: "OPEN",               // ✅ Should be OPEN, not UNASSIGNED
  queueType: "PERSONAL",        // ✅ Should be PERSONAL, not GLOBAL
  assignedAt: ISODate("..."),   // ✅ Should be recent timestamp
  lastActionByXID: "X000001",   // ✅ Should match assignedToXID
  lastActionAt: ISODate("...")  // ✅ Should be recent timestamp
}
```

### Check Audit Trail
```javascript
// Verify audit entry was created
db.caseaudits.find({ 
  caseId: "case2026010900001",
  actionType: "CASE_ASSIGNED"
}).sort({ createdAt: -1 }).limit(1)

// Expected output:
{
  caseId: "case2026010900001",
  actionType: "CASE_ASSIGNED",
  description: "Case pulled from global worklist and assigned to X000001",
  performedByXID: "X000001",
  metadata: {
    queueType: "PERSONAL",
    status: "OPEN",
    assignedTo: "X000001"
  }
}
```

### Check History Entry
```javascript
// Verify history entry was created (legacy)
db.casehistories.find({
  caseId: "case2026010900001",
  actionType: "CASE_ASSIGNED"
}).sort({ createdAt: -1 }).limit(1)

// Expected output:
{
  caseId: "case2026010900001",
  actionType: "CASE_ASSIGNED",
  description: "Case pulled from global worklist and assigned to X000001",
  performedBy: "user@example.com",  // User's email (legacy field)
  performedByXID: "X000001"         // User's xID (canonical)
}
```

---

## 🐛 Common Issues and Troubleshooting

### Issue 1: "User not found" Error

**Symptoms:** Error when pulling case  
**Cause:** Auth middleware couldn't find user  
**Fix:**
- Verify user exists: `db.users.findOne({ xID: "X000001" })`
- Verify JWT token is valid
- Check auth middleware is working

---

### Issue 2: Case Not Appearing in My Worklist

**Symptoms:** Pull succeeds but case doesn't show  
**Debug:**
```javascript
// Check case status
db.cases.findOne({ caseId: "case2026010900001" })

// Expected:
// - assignedToXID: "X000001" (your xID)
// - status: "OPEN" (not "UNASSIGNED" or "Open")
// - queueType: "PERSONAL"

// If status is wrong, it's a bug in assignment service
// If assignedToXID is wrong, it's a bug in authentication
```

---

### Issue 3: Dashboard Count Doesn't Match

**Symptoms:** Dashboard shows different count than My Worklist  
**Debug:**
```javascript
// Count manually
db.cases.countDocuments({
  assignedToXID: "X000001",
  status: "OPEN"
})

// Compare to My Worklist count
// If different, check:
// 1. Is worklist using correct query?
// 2. Is dashboard using same query?
// 3. Are there legacy status values ("Open" vs "OPEN")?
```

---

### Issue 4: "Authentication required" Error

**Symptoms:** Pull button doesn't work  
**Debug:**
- Check `localStorage.getItem('xID')` in browser console
- Check `localStorage.getItem('user')` in browser console
- If null, user is not logged in
- Re-login and try again

---

### Issue 5: Frontend Build Errors

**Symptoms:** `npm run build` fails  
**Fix:**
```bash
cd ui
rm -rf node_modules package-lock.json
npm install
npm run build
```

---

## ✅ Test Result Template

Copy this template for each test run:

```markdown
## Test Run: [Date] [Time]

### Environment
- Backend: [ ] Running [ ] Not Running
- Frontend: [ ] Running [ ] Not Running
- Database: [ ] Connected [ ] Not Connected
- Test User: X000001

### Test Results

| Test # | Test Name | Status | Notes |
|--------|-----------|--------|-------|
| 1 | Single Case Pull | ✅/❌ | |
| 2 | Bulk Case Pull | ✅/❌ | |
| 3 | No Authentication | ✅/❌ | |
| 4 | Race Condition | ✅/❌ | |
| 5 | Already Assigned | ✅/❌ | |
| 6 | Partial Success | ✅/❌ | |
| 7 | Invalid Case ID | ✅/❌ | |
| 8 | No Auth Token | ✅/❌ | |
| 9 | Dashboard Accuracy | ✅/❌ | |
| 10 | Immediate Visibility | ✅/❌ | |

### Summary
- Tests Passed: X/10
- Tests Failed: X/10
- Critical Issues: [List any critical failures]
- Minor Issues: [List any minor issues]

### Recommendations
[Any recommendations for fixes or improvements]
```

---

## 🎯 Acceptance Criteria

All tests must pass for PR to be accepted:

- [ ] Test 1: Single case pull works
- [ ] Test 2: Bulk case pull works
- [ ] Test 3: Authentication enforced
- [ ] Test 4: Race condition handled
- [ ] Test 5: Already assigned handled
- [ ] Test 6: Partial success handled
- [ ] Test 7: Invalid input rejected
- [ ] Test 8: Auth token required
- [ ] Test 9: Dashboard count accurate
- [ ] Test 10: Immediate visibility works

---

## 📞 Support

If you encounter issues not covered in this guide:

1. Check server logs: `npm run dev` (backend)
2. Check browser console: F12 → Console tab
3. Check network requests: F12 → Network tab
4. Review MongoDB: Check case documents directly
5. Review implementation summary: `PR_UNIFIED_PULL_LOGIC_IMPLEMENTATION.md`

---

## 🎓 Test Coverage Summary

| Area | Coverage |
|------|----------|
| Happy Path | ✅ Tests 1, 2 |
| Error Handling | ✅ Tests 3, 5, 7, 8 |
| Race Conditions | ✅ Test 4 |
| Partial Success | ✅ Test 6 |
| UI Integration | ✅ Tests 9, 10 |
| Security | ✅ Tests 3, 7, 8 |
| Data Integrity | ✅ All tests + DB queries |

---

**Total Test Cases:** 10  
**Estimated Testing Time:** 30-45 minutes  
**Recommended Frequency:** Once per deployment  
