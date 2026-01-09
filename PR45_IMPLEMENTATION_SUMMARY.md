# PR #45: View-Only Mode with Audit Logging - Implementation Summary

## Overview
This PR introduces view-only access mode for cases that are not assigned to the current user, maintaining strict ownership rules and full auditability. Users can safely view unassigned or non-owned cases, add comments and attachments, all while ensuring case ownership never changes.

## Changes Made

### 1. Backend Changes

#### New Model: CaseAudit (`src/models/CaseAudit.model.js`)
- **Purpose**: Centralized, immutable audit log for case-related actions
- **Features**:
  - Append-only, immutable schema
  - xID-based attribution (performedByXID field)
  - Action types: `CASE_VIEWED`, `CASE_COMMENT_ADDED`, `CASE_FILE_ATTACHED`, `CASE_CLOSED_VIEWED`
  - Metadata support for additional context
  - Indexed by caseId, performedByXID, and actionType
- **Security**: Pre-hooks prevent updates and deletes

#### Enhanced Case Controller (`src/controllers/case.controller.js`)

**getCaseByCaseId**:
- Detects view-only mode (case not assigned to current user)
- Creates CaseAudit entry with xID attribution
- Returns `accessMode` object with permissions:
  - `isViewOnlyMode`: boolean
  - `isOwner`: boolean
  - `isAssigned`: boolean
  - `canEdit`: boolean (false in view mode)
  - `canComment`: boolean (always true)
  - `canAttach`: boolean (always true)
- Returns audit log entries for display

**addComment**:
- Removed ownership check - allows comments in view mode
- Creates CaseAudit entry with xID and metadata
- Validates authenticated user with xID required
- Maintains backward compatibility with CaseHistory

**addAttachment**:
- Removed ownership check - allows attachments in view mode
- Creates CaseAudit entry with file metadata
- Validates authenticated user with xID required
- Maintains backward compatibility with CaseHistory

### 2. Frontend Changes

#### Updated CaseDetailPage (`ui/src/pages/CaseDetailPage.jsx`)
- **View-Only Mode Indicator**:
  - Yellow badge showing "View-Only Mode"
  - Informational alert explaining access restrictions
- **Dynamic Access Control**:
  - Uses `accessMode` from API response
  - Always shows comment and attachment sections
  - Hides edit/assign/status controls in view mode (future implementation)
- **Enhanced Audit Display**:
  - Shows CaseAudit entries in "Activity Timeline" section
  - Displays xID attribution for all actions
  - Falls back to old CaseHistory if CaseAudit not available
- **Improved Case Information**:
  - Shows assigned user
  - Displays client information
  - Backward compatible with old response format

#### GlobalWorklistPage (No Changes Required)
- Already has "View" button for each case
- Button navigates to case detail page
- View-only mode automatically detected by backend

## Security Guarantees

### 1. Ownership Protection
- ✅ Case `assignedTo` field never modified in view mode
- ✅ Case `createdByXID` field immutable
- ✅ All ownership checks use xID, not email
- ✅ Server-side enforcement (not just UI restrictions)

### 2. Audit Trail
- ✅ All views logged with CASE_VIEWED action
- ✅ All comments logged with CASE_COMMENT_ADDED action
- ✅ All attachments logged with CASE_FILE_ATTACHED action
- ✅ xID attribution for all actions
- ✅ Immutable audit log (CaseAudit model prevents updates/deletes)
- ✅ Centralized storage (not embedded in case document)

### 3. Access Control
- ✅ Authentication required (req.user.xID must exist)
- ✅ Lock checks still enforced (can't interact with locked cases)
- ✅ View mode detection server-side (not client-side only)
- ✅ Comments/attachments allowed in view mode as per requirements

## API Response Changes

### GET /api/cases/:caseId
**Added fields**:
```json
{
  "success": true,
  "data": {
    "case": { /* existing case data */ },
    "client": { /* client details */ },
    "comments": [ /* existing */ ],
    "attachments": [ /* existing */ ],
    "history": [ /* existing CaseHistory */ ],
    "auditLog": [
      {
        "caseId": "CASE-20260109-00001",
        "actionType": "CASE_VIEWED",
        "description": "Case viewed by X123456 (view-only mode)",
        "performedByXID": "X123456",
        "timestamp": "2026-01-09T06:00:00.000Z",
        "metadata": {
          "isViewOnlyMode": true,
          "isOwner": false,
          "isAssigned": false
        }
      }
    ],
    "accessMode": {
      "isViewOnlyMode": true,
      "isOwner": false,
      "isAssigned": false,
      "canEdit": false,
      "canComment": true,
      "canAttach": true
    }
  }
}
```

### POST /api/cases/:caseId/comments
**Changed**: No longer checks case assignment, xID required in auth context

**Audit entries created**:
- CaseAudit: `CASE_COMMENT_ADDED` with xID
- CaseHistory: `CASE_COMMENT_ADDED` (backward compatibility)

### POST /api/cases/:caseId/attachments
**Changed**: No longer checks case assignment, xID required in auth context

**Audit entries created**:
- CaseAudit: `CASE_FILE_ATTACHED` with xID and file metadata
- CaseHistory: `CASE_ATTACHMENT_ADDED` (backward compatibility)

## Non-Goals (Explicitly NOT Changed)

✅ Did NOT change case assignment logic  
✅ Did NOT modify dashboard counts  
✅ Did NOT refactor attachment system (additive only)  
✅ Did NOT introduce role-based access changes  
✅ Did NOT infer ownership from activity  

## Testing Checklist

### Backend Tests
- [ ] Test case view with unassigned case (should log CASE_VIEWED)
- [ ] Test case view with non-owned case (should show view-only mode)
- [ ] Test case view with assigned case (should show full edit mode)
- [ ] Test comment addition in view mode (should succeed)
- [ ] Test attachment upload in view mode (should succeed)
- [ ] Verify CaseAudit entries are created correctly
- [ ] Verify case ownership never changes in view mode
- [ ] Verify xID is required for all operations
- [ ] Test with locked case (should still prevent interactions)
- [ ] Verify backward compatibility with CaseHistory

### Frontend Tests
- [ ] View case from Global Worklist (should show view-only mode)
- [ ] View own case (should show full access mode)
- [ ] Add comment in view mode (should work)
- [ ] Add attachment in view mode (should work)
- [ ] Verify view-only badge appears
- [ ] Verify view-only alert appears
- [ ] Verify audit log displays correctly
- [ ] Verify assigned user shows correctly

### Integration Tests
- [ ] Navigate from Global Worklist → View case
- [ ] Navigate from Reports → View case
- [ ] Navigate from MIS → View case
- [ ] Pull case from worklist (should change to full edit mode)
- [ ] View case details after pulling (should show as assigned)

## Database Changes

### New Collection: `caseaudits`
```javascript
{
  _id: ObjectId,
  caseId: String,           // e.g., "CASE-20260109-00001"
  actionType: String,       // enum: CASE_VIEWED, CASE_COMMENT_ADDED, etc.
  description: String,      // human-readable description
  performedByXID: String,   // e.g., "X123456" (uppercase, required)
  timestamp: Date,          // immutable, default: Date.now
  metadata: Mixed           // optional additional context
}
```

**Indexes**:
- `{ caseId: 1, timestamp: -1 }` - primary query pattern
- `{ performedByXID: 1 }` - user activity tracking
- `{ actionType: 1 }` - filter by action type

## Migration Notes

### Existing Data
- No migration required for existing data
- CaseAudit is a new collection
- CaseHistory remains unchanged
- Both collections coexist for backward compatibility

### Deployment
1. Deploy backend changes first
2. CaseAudit collection will be created automatically
3. Deploy frontend changes
4. No downtime required

## Future Enhancements (Out of Scope)

- CASE_CLOSED_VIEWED action when user closes view mode
- UI controls for edit/assign/status change (currently no UI for these)
- File attachment viewer
- Advanced audit log filtering
- Audit log export
- Role-based view restrictions
- View mode session tracking

## References

- PR #41: Initial comment/attachment in view mode support
- PR #42: xID-based ownership system
- PR #44: xID ownership guardrails
- PR #45: View-only mode with comprehensive audit logging (this PR)

## Compliance & Audit

### Immutability Guarantees
- ✅ CaseAudit entries cannot be updated (schema pre-hooks)
- ✅ CaseAudit entries cannot be deleted (schema pre-hooks)
- ✅ Timestamps are immutable
- ✅ Append-only logging pattern

### Audit Trail Completeness
- ✅ Every case view logged
- ✅ Every comment logged
- ✅ Every file attachment logged
- ✅ xID attribution for accountability
- ✅ Metadata for context
- ✅ Centralized storage for queries

### Privacy & Security
- ✅ xID used instead of email for audit attribution
- ✅ Server-side permission enforcement
- ✅ No ownership mutation in view mode
- ✅ Lock status still enforced
- ✅ Authentication required for all operations
