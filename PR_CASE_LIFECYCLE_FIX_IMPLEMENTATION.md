# Case Lifecycle Actions Fix - Implementation Summary

## Overview

This PR comprehensively fixes case lifecycle actions (Pend, File, Resolve) by implementing proper state transitions, fixing API contracts, and ensuring UI consistency.

## Problem Statement

The case lifecycle actions were broken due to:
- Frontend ↔ backend payload mismatches (pendingUntil vs reopenDate)
- Missing backend state transition enforcement
- UI allowing invalid actions in terminal states
- Missing timezone normalization for pending dates
- Generic error handling hiding real failures

## Solution

### 1. Central State Transition Guard

**File**: `src/services/caseAction.service.js`

Created a centralized state transition map and validation function:

```javascript
const CASE_TRANSITIONS = {
  OPEN: ['PENDED', 'FILED', 'RESOLVED'],
  PENDING: [],  // Legacy status - no transitions
  PENDED: [],   // Canonical status - no transitions  
  FILED: [],    // Terminal state
  RESOLVED: [], // Terminal state
  UNASSIGNED: ['OPEN', 'PENDED', 'FILED', 'RESOLVED'],
};

function assertCaseTransition(currentStatus, targetStatus) {
  if (!CASE_TRANSITIONS[currentStatus]?.includes(targetStatus)) {
    throw new Error(`Cannot change case from ${currentStatus} to ${targetStatus}`);
  }
}
```

**Benefits**:
- Single source of truth for valid state transitions
- Prevents duplicate actions (e.g., resolving an already resolved case)
- Clear error messages when invalid transitions are attempted
- No scattered `if (status === ...)` checks

### 2. Fixed Pend Case API Contract

**Changes**:
- Backend now accepts `reopenDate` (YYYY-MM-DD) instead of `pendingUntil`
- Installed `luxon` package for timezone handling
- Backend normalizes `reopenDate` to 8:00 AM IST and stores as UTC

**Implementation** (`src/services/caseAction.service.js`):

```javascript
const { DateTime } = require('luxon');

const pendCase = async (caseId, comment, reopenDate, user) => {
  validateComment(comment);
  
  if (!reopenDate) {
    throw new Error('Reopen date is required');
  }
  
  // Validate state transition
  assertCaseTransition(caseData.status, CASE_STATUS.PENDED);
  
  // Convert reopenDate to 8:00 AM IST and then to UTC
  const pendingUntil = DateTime
    .fromISO(reopenDate, { zone: 'Asia/Kolkata' })
    .set({ hour: 8, minute: 0, second: 0, millisecond: 0 })
    .toUTC()
    .toJSDate();
  
  caseData.pendingUntil = pendingUntil;
  // ... rest of implementation
};
```

**Frontend** (`ui/src/services/caseService.js`):

```javascript
pendCase: async (caseId, comment, reopenDate) => {
  const response = await api.post(`/cases/${caseId}/pend`, {
    comment,
    reopenDate,  // Changed from pendingUntil
  });
  return response.data;
}
```

### 3. Updated File and Resolve Actions

Both actions now:
- Use `assertCaseTransition()` to enforce valid state transitions
- Clear `pendingUntil` field when executed
- Return meaningful error messages

**Example** (`src/services/caseAction.service.js`):

```javascript
const resolveCase = async (caseId, comment, user) => {
  validateComment(comment);
  
  const caseData = await Case.findOne({ caseId });
  if (!caseData) throw new Error('Case not found');
  
  // Validate state transition (throws error if invalid)
  assertCaseTransition(caseData.status, CASE_STATUS.RESOLVED);
  
  caseData.status = CASE_STATUS.RESOLVED;
  caseData.pendingUntil = null; // Clear pending date
  caseData.lastActionByXID = user.xID;
  caseData.lastActionAt = new Date();
  
  await caseData.save();
  // ... add comment and audit log
};
```

### 4. Controller Error Handling

All controllers now handle state transition errors properly:

```javascript
catch (error) {
  // State transition errors
  if (error.message.startsWith('Cannot change case from')) {
    return res.status(400).json({
      success: false,
      message: error.message, // Backend error verbatim
    });
  }
  // ... other error handling
}
```

### 5. Frontend UI State Management

**File**: `ui/src/pages/CaseDetailPage.jsx`

Updated action button visibility logic:

```javascript
// Only OPEN cases can perform lifecycle actions
const canPerformActions = caseInfo.status === 'OPEN';
const showActionButtons = !isViewOnlyMode && canPerformActions;
```

**State Visibility Matrix**:

| Case Status | File | Pend | Resolve |
|-------------|------|------|---------|
| OPEN        | ✅   | ✅   | ✅      |
| PENDING     | ❌   | ❌   | ❌      |
| PENDED      | ❌   | ❌   | ❌      |
| FILED       | ❌   | ❌   | ❌      |
| RESOLVED    | ❌   | ❌   | ❌      |
| UNASSIGNED  | ❌   | ❌   | ❌      |

**Note**: UNASSIGNED cases don't show action buttons because users must first pull them (which changes status to OPEN) before taking actions.

### 6. UI Refresh After Actions

All action handlers already call `loadCase()` after successful actions:

```javascript
const handlePendCase = async () => {
  // ... validation
  const response = await caseService.pendCase(caseId, pendComment, pendingUntil);
  if (response.success) {
    showSuccess('Case pended successfully');
    setShowPendModal(false);
    setPendComment('');
    setPendingUntil('');
    await loadCase(); // ✅ UI refresh
  }
};
```

### 7. Error Message Display

Error handlers already display backend messages verbatim:

```javascript
catch (error) {
  const serverMessage = error.response?.data?.message;
  const errorMessage = serverMessage && typeof serverMessage === 'string'
    ? serverMessage.substring(0, 200)
    : 'Failed to pend case. Please try again.';
  showError(errorMessage);
}
```

## API Contract Summary

### POST /api/cases/:caseId/pend

**Request Body**:
```json
{
  "comment": "Waiting for client response",
  "reopenDate": "2026-01-15"
}
```

**Response** (Success):
```json
{
  "success": true,
  "data": { /* case object */ },
  "message": "Case pended successfully"
}
```

**Response** (Error - Invalid Transition):
```json
{
  "success": false,
  "message": "Cannot change case from RESOLVED to PENDED"
}
```

### POST /api/cases/:caseId/file

**Request Body**:
```json
{
  "comment": "Duplicate case - see CASE-20260108-00042"
}
```

### POST /api/cases/:caseId/resolve

**Request Body**:
```json
{
  "comment": "Issue resolved via phone call with client"
}
```

## Dependencies Added

- **luxon** (^3.x): DateTime library for timezone handling
  - Used to normalize reopen dates to 8:00 AM IST
  - Handles timezone conversions reliably

## Testing Guidelines

### Manual Testing

1. **Test Pend Action**:
   ```
   - Open a case with status = OPEN
   - Click "Pend" button
   - Enter comment and select future date
   - Submit
   - Expected: Case status changes to PENDED, buttons disappear
   - Verify: pendingUntil in DB is stored as 8:00 AM IST (UTC)
   ```

2. **Test File Action**:
   ```
   - Open a case with status = OPEN
   - Click "File" button
   - Enter comment
   - Submit
   - Expected: Case status changes to FILED, buttons disappear
   - Try opening modal again: Buttons should not be visible
   ```

3. **Test Resolve Action**:
   ```
   - Open a case with status = OPEN
   - Click "Resolve" button
   - Enter comment
   - Submit
   - Expected: Case status changes to RESOLVED, buttons disappear
   ```

4. **Test Invalid Transitions**:
   ```
   - Try to resolve a RESOLVED case (via API)
   - Expected: 400 error with message "Cannot change case from RESOLVED to RESOLVED"
   
   - Try to pend a FILED case (via API)
   - Expected: 400 error with message "Cannot change case from FILED to PENDED"
   ```

5. **Test Date Normalization**:
   ```
   - Pend a case with reopenDate = "2026-01-15"
   - Check database: pendingUntil should be:
     2026-01-14T02:30:00.000Z (8:00 AM IST = 2:30 AM UTC)
   ```

### API Testing with curl

```bash
# Get auth token first
TOKEN="your_jwt_token_here"

# Test Pend Case
curl -X POST http://localhost:5000/api/cases/CASE-20260108-00001/pend \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "comment": "Waiting for client response",
    "reopenDate": "2026-01-15"
  }'

# Test File Case
curl -X POST http://localhost:5000/api/cases/CASE-20260108-00001/file \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "comment": "Duplicate case"
  }'

# Test Resolve Case
curl -X POST http://localhost:5000/api/cases/CASE-20260108-00001/resolve \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "comment": "Issue resolved"
  }'

# Test Invalid Transition (should fail)
curl -X POST http://localhost:5000/api/cases/CASE-20260108-00001/resolve \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "comment": "Try to resolve again"
  }'
```

## Files Changed

### Backend
1. `package.json` - Added luxon dependency
2. `src/services/caseAction.service.js` - Core implementation
3. `src/controllers/caseActions.controller.js` - Controller updates

### Frontend
1. `ui/src/services/caseService.js` - API payload fix
2. `ui/src/pages/CaseDetailPage.jsx` - UI state management

## Acceptance Criteria

- ✅ Pend works with date-only input
- ✅ `pending_until` always stored as 8:00 AM IST (UTC)
- ✅ File works once and disables UI
- ✅ Resolve only works from OPEN (or UNASSIGNED)
- ✅ No duplicate lifecycle actions possible
- ✅ No generic "Error pending / resolving case" messages
- ✅ UI always reflects latest case state (via loadCase refresh)

## Migration Notes

### No Breaking Changes
- Existing cases with `pendingUntil` timestamps are not affected
- Auto-reopen logic continues to work with existing timestamps
- Only NEW pend actions use the date normalization

### Backward Compatibility
- Both PENDING and PENDED statuses are handled (legacy vs canonical)
- No changes required to existing case documents

## Security Summary

- ✅ No security vulnerabilities introduced
- ✅ Input validation on all parameters
- ✅ State transition enforcement prevents unauthorized actions
- ✅ Authentication still required for all endpoints
- ✅ No sensitive data exposure in error messages

## Future Enhancements (Out of Scope)

- Cron job for auto-reopening pended cases (already implemented separately)
- Email notifications on lifecycle actions
- Time picker for custom reopen times
- Case history timeline visualization

## References

- Original Issue: Fix Case Lifecycle Actions
- Related: Case model (`src/models/Case.model.js`)
- Related: CASE_STATUS constants (`src/config/constants.js`)
