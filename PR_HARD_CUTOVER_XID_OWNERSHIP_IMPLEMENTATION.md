# PR: Hard Cutover to xID-Based Ownership

## 🎯 Objective

Complete the migration from email-based to xID-based ownership by removing all email parameters from pull, worklist, and dashboard endpoints. This PR ensures that **xID is the only identity used for case assignment and ownership queries**.

---

## 🚨 Breaking Changes

This PR intentionally breaks backward compatibility with email-based assignment:

1. **Legacy endpoint removed**: `POST /api/cases/:caseId/pull`
2. **Unified endpoint**: `POST /api/cases/pull` (accepts single or multiple caseIds)
3. **Email parameters removed**: All worklist and search endpoints now use `req.user` from auth middleware
4. **Frontend updated**: All components now call unified pull endpoint

---

## 📋 Changes Summary

### Backend Changes

#### 1. Unified Pull Endpoint

**Before:**
- `POST /api/cases/:caseId/pull` - Pull single case
- `POST /api/cases/bulk-pull` - Pull multiple cases

**After:**
- `POST /api/cases/pull` - Pull single or multiple cases

**New Behavior:**
```javascript
// Single case pull
POST /api/cases/pull
{
  "caseIds": ["CASE-20260109-00001"]
}

// Multiple case pull
POST /api/cases/pull
{
  "caseIds": ["CASE-20260109-00001", "CASE-20260109-00002"]
}
```

**Rejected Payloads:**
- Contains `userEmail` (must come from auth token)
- Contains `userXID` (must come from auth token)

#### 2. Worklist Endpoints - Email Parameter Removed

**Before:**
```javascript
GET /api/worklists/employee/me?email=user@example.com
```

**After:**
```javascript
GET /api/worklists/employee/me
```

User identity is now obtained from `req.user` (set by authentication middleware).

#### 3. Search Endpoints - Email Parameter Removed

**Before:**
```javascript
GET /api/search?q=term&email=user@example.com
GET /api/worklists/category/:categoryId?email=user@example.com
```

**After:**
```javascript
GET /api/search?q=term
GET /api/worklists/category/:categoryId
```

User identity is now obtained from `req.user` (set by authentication middleware).

### Frontend Changes

#### 1. Unified Pull Service

**Before:**
```javascript
// worklistService.js
pullCase: async (caseId) => {
  const response = await api.post(`/cases/${caseId}/pull`);
  return response.data;
}

bulkPullCases: async (caseIds) => {
  const response = await api.post('/cases/bulk-pull', { caseIds });
  return response.data;
}
```

**After:**
```javascript
// worklistService.js
pullCases: async (caseIds) => {
  // Ensure caseIds is an array
  const ids = Array.isArray(caseIds) ? caseIds : [caseIds];
  const response = await api.post('/cases/pull', { caseIds: ids });
  return response.data;
}
```

#### 2. Worklist Service - Email Parameter Removed

**Before:**
```javascript
getEmployeeWorklist: async (email) => {
  const params = email ? `?email=${encodeURIComponent(email)}` : '';
  const response = await api.get(`/worklists/employee/me${params}`);
  return response.data;
}
```

**After:**
```javascript
getEmployeeWorklist: async () => {
  const response = await api.get('/worklists/employee/me');
  return response.data;
}
```

#### 3. Component Updates

All components updated to use the new unified API:
- `GlobalWorklistPage.jsx` - Uses `pullCases()` for both single and bulk pull
- `DashboardPage.jsx` - Uses `getEmployeeWorklist()` without email parameter
- `WorklistPage.jsx` - Uses `getEmployeeWorklist()` without email parameter

---

## 🗄️ Data Migration

### Migration Script: `hardCutoverRemoveAssignedTo.js`

This script performs the final hard cutover by:

1. **Pre-validation**: Checks data integrity before making changes
2. **Final migration**: Copies any remaining `assignedTo` to `assignedToXID`
3. **Removal**: Removes the legacy `assignedTo` field entirely
4. **Post-validation**: Verifies the cutover was successful

#### Usage

**Dry run (preview changes):**
```bash
DRY_RUN=true node src/scripts/hardCutoverRemoveAssignedTo.js
```

**Live execution (IRREVERSIBLE):**
```bash
DRY_RUN=false node src/scripts/hardCutoverRemoveAssignedTo.js
```

#### What the Script Does

**Pre-Validation Checks:**
- ✅ All assigned cases have `assignedToXID`
- ✅ All PERSONAL queue cases have `assignedToXID`
- ✅ No GLOBAL queue cases have `assignedToXID`

**Migration Actions:**
- Copies `assignedTo` → `assignedToXID` for any remaining cases
- Removes the `assignedTo` field from all documents

**Post-Validation Checks:**
- ✅ No cases have legacy `assignedTo` field
- ✅ All PERSONAL cases have `assignedToXID`
- ✅ All GLOBAL cases correctly unassigned

---

## ✅ Acceptance Criteria

All acceptance criteria from the problem statement have been met:

### 1. ✅ Pull Operations Use xID Only

**Evidence:**
- `pullCases()` function in `case.controller.js` uses `req.user.xID` only
- Rejects payloads containing `userEmail` or `userXID`
- User identity obtained from authentication middleware only

**Test:**
```bash
# This should be REJECTED
curl -X POST http://localhost:5000/api/cases/pull \
  -H "Content-Type: application/json" \
  -d '{"caseIds": ["CASE-20260109-00001"], "userEmail": "test@example.com"}'

# Expected: 400 Bad Request
# "userEmail and userXID must not be provided in request body"
```

### 2. ✅ Worklist Queries Use xID Only

**Evidence:**
- `employeeWorklist()` in `search.controller.js` uses `req.user.xID`
- No email parameters accepted
- Query: `assignedToXID = user.xID AND status = OPEN`

**Test:**
```bash
# Email parameter is ignored
curl -X GET http://localhost:5000/api/worklists/employee/me \
  -H "x-user-id: X000001"

# Response contains cases where assignedToXID = X000001 and status = OPEN
```

### 3. ✅ Dashboard Counts Match Worklist

**Evidence:**
- Dashboard calls `worklistService.getEmployeeWorklist()`
- Both use the same backend query: `assignedToXID = xID AND status = OPEN`
- No discrepancy between count and worklist

**Test:**
1. Pull a case from global worklist
2. Check dashboard "My Open Cases" count
3. Check "My Worklist" table
4. Count should match worklist length

### 4. ✅ Case Document Has Correct Fields

**Evidence:**
After pull operation, case document has:
```json
{
  "assignedToXID": "X000001",
  "queueType": "PERSONAL",
  "status": "OPEN",
  "assignedAt": "2026-01-09T14:30:00.000Z",
  "lastActionByXID": "X000001"
}
```

**Test:**
```javascript
// In MongoDB shell
db.cases.findOne({ caseId: "CASE-20260109-00001" })
// Should show assignedToXID, NOT assignedTo
```

### 5. ✅ Case Appears in Correct Worklists

**Evidence:**
- After pull: Case disappears from Global Worklist (status changes from UNASSIGNED to OPEN)
- After pull: Case appears in My Worklist (assignedToXID set, status OPEN)
- Dashboard count increments

### 6. ✅ No Email in Logs

**Evidence:**
- Pull logs show: `userXID: X000001`
- Worklist queries use: `assignedToXID: X000001`
- No `userEmail` in request bodies or logs

---

## 🔍 Code Review Checklist

Before merging, verify:

- [ ] ✅ No `userEmail` in pull endpoint payloads
- [ ] ✅ No email query parameters in worklist endpoints
- [ ] ✅ All pull operations use `caseAssignmentService`
- [ ] ✅ All worklist queries use `assignedToXID`
- [ ] ✅ Dashboard and worklist use same query
- [ ] ✅ Frontend components updated to use unified API
- [ ] ✅ Migration script tested in dry-run mode
- [ ] ✅ No syntax errors in modified files

---

## 🧪 Testing Guide

### Manual Testing

#### 1. Test Pull Operation

```bash
# Login and get authentication token
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"xID": "X000001", "password": "password123"}'

# Pull a case (should succeed)
curl -X POST http://localhost:5000/api/cases/pull \
  -H "Content-Type: application/json" \
  -H "x-user-id: X000001" \
  -d '{"caseIds": ["CASE-20260109-00001"]}'

# Try with userEmail (should fail)
curl -X POST http://localhost:5000/api/cases/pull \
  -H "Content-Type: application/json" \
  -H "x-user-id: X000001" \
  -d '{"caseIds": ["CASE-20260109-00002"], "userEmail": "test@example.com"}'
```

#### 2. Test Worklist Query

```bash
# Get my worklist (should succeed)
curl -X GET http://localhost:5000/api/worklists/employee/me \
  -H "x-user-id: X000001"

# Email parameter is ignored (should still succeed)
curl -X GET http://localhost:5000/api/worklists/employee/me?email=wrong@example.com \
  -H "x-user-id: X000001"
```

#### 3. Test Dashboard

1. Open browser and login
2. Navigate to Dashboard
3. Pull a case from Global Worklist
4. Verify dashboard count increments
5. Navigate to My Worklist
6. Verify case appears in worklist

### Migration Testing

```bash
# Dry run first
DRY_RUN=true node src/scripts/hardCutoverRemoveAssignedTo.js

# Review output, then run live
DRY_RUN=false node src/scripts/hardCutoverRemoveAssignedTo.js
```

---

## 📝 Migration Runbook

For production deployment, follow this sequence:

### Phase 1: Code Deployment (This PR)
1. Deploy backend changes to staging
2. Deploy frontend changes to staging
3. Test all endpoints in staging
4. Deploy to production

### Phase 2: Data Migration (After Deployment)
1. Run migration in dry-run mode:
   ```bash
   DRY_RUN=true node src/scripts/hardCutoverRemoveAssignedTo.js
   ```
2. Review output and verify counts
3. Run migration in live mode:
   ```bash
   DRY_RUN=false node src/scripts/hardCutoverRemoveAssignedTo.js
   ```
4. Verify post-validation passes

### Phase 3: Verification
1. Pull test cases from Global Worklist
2. Verify cases appear in My Worklist
3. Verify dashboard counts are correct
4. Check logs for no email-based queries
5. Verify Global Worklist updates correctly

---

## 🎉 Benefits

After this PR:

1. **Single Source of Truth**: xID is the only identifier for ownership
2. **No Identity Mismatch**: Pull and worklist use the same field
3. **Simplified Code**: One pull endpoint instead of two
4. **Better Security**: User identity from auth token only
5. **Data Integrity**: Consistent assignment fields across all cases

---

## 🚀 Future Work

Optional follow-up improvements:

1. Add rate limiting to pull endpoint
2. Add metrics/monitoring for pull operations
3. Add bulk pull limits (max cases per request)
4. Add pull history tracking
5. Add case unassignment endpoint

---

## 📚 References

- **Problem Statement**: Original issue describing the hard cutover requirements
- **PR #42**: Initial xID migration
- **PR #44**: xID ownership guardrails
- **Migration Script**: `src/scripts/hardCutoverRemoveAssignedTo.js`

---

## ⚠️ Rollback Plan

If issues are discovered after deployment:

1. **Code Rollback**: Revert to previous deployment
2. **Data Rollback**: NOT POSSIBLE after running migration script
3. **Mitigation**: The migration script includes pre-validation to prevent data loss

**IMPORTANT**: Do not run the migration script until the code changes are thoroughly tested and verified in production.
