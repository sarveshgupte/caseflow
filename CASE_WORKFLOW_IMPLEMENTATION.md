# Case Workflow System Implementation Summary

This document summarizes the implementation of the case-driven workflow system with client governance, admin approval hierarchy, and case locking features.

## Overview

The implementation introduces a comprehensive case workflow system that:
1. Removes title as a required field for cases
2. Implements deterministic case ID generation (CASE-YYYYMMDD-XXXXX format)
3. Establishes client governance via cases
4. Enforces admin approval hierarchy
5. Implements case locking with 2-hour inactivity auto-unlock
6. Adds workflow state management

## Key Changes

### 1. Case Model Updates

**File**: `src/models/Case.model.js`

- **Case ID Format**: Changed from `DCK-XXXX` to `CASE-YYYYMMDD-XXXXX` (e.g., `CASE-20260108-00012`)
  - Daily sequence reset
  - Zero-padded 5-digit sequence
  - Immutable after creation

- **Title Field**: Made optional (no longer required)

- **New Fields**:
  - `caseCategory` (required): Primary category that drives workflows
  - `caseSubCategory` (optional): Additional categorization
  - `payload`: Stores proposed client changes for governance cases
  - `submittedAt`, `submittedBy`: Submission tracking
  - `approvedAt`, `approvedBy`: Approval tracking
  - `decisionComments`: Admin decision notes
  - `lockStatus.lastActivityAt`: For 2-hour auto-unlock

- **New Workflow States**:
  - `DRAFT`: Being edited by creator
  - `SUBMITTED`: Locked, awaiting review
  - `UNDER_REVIEW`: Being reviewed by admin
  - `APPROVED`: Changes applied to DB
  - `REJECTED`: Declined, no DB mutation
  - `CLOSED`: Completed
  - Legacy states (`Open`, `Reviewed`, `Pending`, `Filed`, `Archived`) retained for backward compatibility

### 2. Default Client System

**Files**: 
- `src/models/Client.model.js`
- `src/scripts/seedOrganizationClient.js`

- Default client ID changed from `C123456` to `C000001`
- System client (`isSystemClient: true`) cannot be deleted or edited
- All cases default to `C000001` if no client specified
- Client ID format: `C000001`, `C000002`, etc. (6-digit zero-padded)

### 3. Case ID Generator

**File**: `src/services/caseIdGenerator.js`

New service that generates deterministic case IDs:
- Format: `CASE-YYYYMMDD-XXXXX`
- Daily sequence reset
- Example: `CASE-20260108-00012`
- Functions:
  - `generateCaseId()`: Generates new case ID
  - `isValidCaseIdFormat(caseId)`: Validates format
  - `extractDateFromCaseId(caseId)`: Extracts date from ID

### 4. Client Governance Workflow

**File**: `src/controllers/clientApproval.controller.js`

- Client mutations only through approved cases
- Three case categories:
  - `Client - New`: Create new client
  - `Client - Edit`: Update existing client
  - `Client - Delete`: Deactivate client
- Proposed changes stored in `case.payload`:
  ```javascript
  {
    action: "NEW" | "EDIT" | "DELETE",
    clientId: "C000002",  // for EDIT/DELETE
    clientData: {...},    // for NEW
    updates: {...}        // for EDIT
  }
  ```
- Changes applied only on approval (status → `APPROVED`)
- Rejections don't mutate client data (status → `REJECTED`)

### 5. Admin Approval Hierarchy

**Files**:
- `src/models/User.model.js`
- `src/middleware/adminApproval.middleware.js`
- `src/routes/clientApproval.routes.js`

- New User field: `canApproveClients` (boolean)
- Top-most admins can approve client cases:
  - `managerId = null` OR
  - `canApproveClients = true`
- Hierarchy enforced in backend middleware
- Applied to approval endpoints:
  - `POST /api/client-approval/:caseId/approve-new`
  - `POST /api/client-approval/:caseId/approve-edit`
  - `POST /api/client-approval/:caseId/reject`

### 6. Case Locking with Auto-Unlock

**Files**:
- `src/controllers/case.controller.js`
- `src/middleware/caseLock.middleware.js`

- Soft locking prevents simultaneous edits
- Lock includes:
  - `isLocked`: Boolean flag
  - `activeUserEmail`: Lock holder
  - `lockedAt`: Lock timestamp
  - `lastActivityAt`: Last activity timestamp
- **2-hour inactivity auto-unlock**:
  - If `lastActivityAt` > 2 hours ago, lock is auto-released
  - Logged in case history
- New endpoints:
  - `POST /api/cases/:caseId/lock`: Acquire lock
  - `POST /api/cases/:caseId/unlock`: Release lock
  - `POST /api/cases/:caseId/activity`: Update activity (heartbeat)
- Read-only mode when locked by another user

### 7. Workflow State Transitions

**File**: `src/controllers/caseWorkflow.controller.js`

New endpoints for state management:
- `POST /api/cases/:caseId/submit`: DRAFT → SUBMITTED
- `POST /api/cases/:caseId/review`: SUBMITTED → UNDER_REVIEW
- `POST /api/cases/:caseId/close`: Any → CLOSED
- `POST /api/cases/:caseId/reopen`: CLOSED/REJECTED → DRAFT

All transitions logged in case history.

### 8. UI Updates

**Files**:
- `ui/src/pages/CreateCasePage.jsx`
- `ui/src/pages/CaseDetailPage.jsx`
- `ui/src/utils/constants.js`

- **CreateCasePage**:
  - Title field now optional
  - `caseCategory` dropdown (required)
  - `caseSubCategory` input (optional)
  - Client dropdown with default to `C000001`
  - Loads all clients from API
  
- **CaseDetailPage**:
  - Lock status warning when case is locked by another user
  - Shows lock holder and last activity time
  - Read-only mode indication

- **Constants**:
  - Added new workflow states
  - Added all case categories
  - Added `DEFAULT_CLIENT_ID = 'C000001'`

## Database Migration Notes

### Required Steps

1. **Seed Organization Client**:
   ```bash
   node src/scripts/seedOrganizationClient.js
   ```
   Creates default client `C000001`.

2. **Seed Categories**:
   ```bash
   node src/scripts/seedCategories.js
   ```
   Adds "Client - Delete" category.

3. **Existing Cases**:
   - Existing cases with old `DCK-XXXX` IDs remain valid
   - New cases use `CASE-YYYYMMDD-XXXXX` format
   - Both formats coexist (backward compatible)
   - Consider migration script if consistent format needed

4. **Existing Clients**:
   - Existing clients starting from `C123456` remain valid
   - New clients start from highest existing + 1
   - Organization client (`C000001`) should be created separately

## API Examples

### Create Case (without title)

```javascript
POST /api/cases
{
  "caseCategory": "Client - New",
  "clientId": "C000001",  // Optional, defaults to C000001
  "description": "Request to create new client ABC Corp",
  "createdBy": "user@example.com",
  "payload": {
    "action": "NEW",
    "clientData": {
      "businessName": "ABC Corp",
      "businessAddress": "123 Main St",
      "businessPhone": "555-1234",
      "businessEmail": "abc@example.com"
    }
  }
}
```

### Lock Case

```javascript
POST /api/cases/CASE-20260108-00012/lock
{
  "userEmail": "user@example.com"
}
```

### Update Activity (Heartbeat)

```javascript
POST /api/cases/CASE-20260108-00012/activity
{
  "userEmail": "user@example.com"
}
```

### Submit Case for Review

```javascript
POST /api/cases/CASE-20260108-00012/submit
{
  "userEmail": "user@example.com"
}
```

### Approve Client Case

```javascript
POST /api/client-approval/CASE-20260108-00012/approve-new
{
  "approverEmail": "admin@example.com",
  "comment": "Approved - all information verified"
}
```

## Security Considerations

1. **Admin Hierarchy**: Enforced in backend middleware only (UI checks are supplementary)
2. **Case Locking**: Soft lock - can be auto-released after 2 hours
3. **Client Immutability**: System clients (`isSystemClient: true`) cannot be edited
4. **Audit Trail**: All state transitions and approvals logged in `CaseHistory`
5. **Payload Validation**: Client data validated before approval

## Testing

Run the test script to verify case ID generation:
```bash
node src/scripts/testCaseIdGenerator.js
```

## Future Enhancements (Not in This PR)

- Case cloning/forking UI
- Notifications for case state changes
- SLA timers and deadline tracking
- Bulk approval operations
- Advanced search and filtering
- Case templates

## Breaking Changes

⚠️ **Minor Breaking Changes**:
1. Case creation API now expects `caseCategory` instead of just `category`
2. Default client ID changed from `C123456` to `C000001`
3. Case IDs now use different format (`CASE-YYYYMMDD-XXXXX` vs `DCK-XXXX`)

**Backward Compatibility**:
- Old `category` field still supported (maps to `caseCategory`)
- Legacy case statuses (`Open`, `Reviewed`, etc.) still work
- Existing cases with old IDs remain functional

## Conclusion

This implementation establishes a robust case workflow system with:
- ✅ Fixed case creation (title optional)
- ✅ Deterministic case ID generation
- ✅ Client governance via cases
- ✅ Hierarchy-based admin approval
- ✅ Case locking with 2-hour auto-unlock
- ✅ Comprehensive workflow state management
- ✅ Full audit trail

All requirements from the problem statement have been addressed.
