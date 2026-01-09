# PR #42: Case Assignment Migration Guide

## Overview
This document explains the changes made in PR #42 to standardize case assignment identifiers from email addresses to xID.

## Problem
Previously, the `assignedTo` field in the Case model inconsistently stored either:
- User email addresses (e.g., `john.doe@example.com`)
- User xIDs (e.g., `X123456`)

This inconsistency caused:
- Cases not appearing in "My Worklist" even when assigned
- Dashboard counts showing 0 despite cases existing
- Mismatch between what Reports/MIS showed vs. what users could see

## Solution
**Canonical Identifier**: All case assignments now use xID as the single source of truth.

## Changes Made

### 1. Case Model (`src/models/Case.model.js`)
- Updated `assignedTo` field documentation to clarify it stores xID
- Changed field configuration to `uppercase: true` (was `lowercase: true`)
- Added comprehensive documentation

### 2. Case Assignment APIs (`src/controllers/case.controller.js`)
- **`pullCase`**: Now sets `assignedTo = req.user.xID` (was email)
- **`bulkPullCases`**: Now sets `assignedTo = req.user.xID` (was email)
- **`createCase`**: If assignedTo is provided, treats it as xID (uppercase)
- **`getCases`**: Added smart detection - recognizes xID pattern vs email

### 3. Worklist Queries (`src/controllers/search.controller.js`)
- **`employeeWorklist`**: Now queries by `user.xID` (was email)
- **`globalSearch`**: Updated visibility rules to match by xID

### 4. Reports (`src/controllers/reports.controller.js`)
All report endpoints now:
- Resolve xID → user info for display
- Show email address instead of raw xID
- Include backward compatibility fallback

Updated endpoints:
- `getCaseMetrics`
- `getPendingCasesReport`
- `getCasesByDateRange`
- `exportCasesCSV`
- `exportCasesExcel`

### 5. Migration Script (`src/scripts/migrateAssignedToXID.js`)
One-time migration script to convert existing data:
- Finds all cases where `assignedTo` contains an email (has @ symbol)
- Resolves email → user → xID
- Updates the case with the xID
- Creates audit trail entry

## Deployment Instructions

### Step 1: Deploy Code
Deploy the updated code to your environment (staging/production).

### Step 2: Run Migration Script
**IMPORTANT**: Run this script ONCE after deploying the code.

```bash
# Connect to your server/environment
cd /path/to/Docketra

# Ensure .env is configured with correct MONGODB_URI
# Run the migration script
node src/scripts/migrateAssignedToXID.js
```

The script will:
- Show progress for each case migrated
- Print a summary at the end
- Be safe to run multiple times (idempotent)
- Create audit log entries for all changes

### Step 3: Verify
After migration, verify:

1. **My Worklist**: Users can see their assigned cases
2. **Dashboard**: Counts are correct
3. **Global Worklist**: Shows only unassigned cases
4. **Reports**: Still display assigned users correctly

## Backward Compatibility

The system includes several backward compatibility measures:

1. **Reports**: All reports check for both xID and email when resolving user info
2. **getCases Filter**: Smart detection of xID vs email format
3. **Migration Script**: Automatically converts old email assignments

## Testing Checklist

- [ ] Pull a case from Global Worklist → appears in My Worklist
- [ ] Dashboard shows correct case counts
- [ ] Reports display assigned user email (not xID)
- [ ] Bulk pull works correctly
- [ ] Search finds cases by assignment
- [ ] CSV/Excel exports show user emails

## Rollback Plan

If issues occur:
1. Keep the code deployed (it has backward compatibility)
2. Cases with xID will work correctly
3. Cases with email will still be readable (but won't appear in worklists)
4. Re-run migration script to fix any stragglers

## Technical Details

### xID Format
- Pattern: `X` followed by 6 digits
- Example: `X123456`
- Case: Always uppercase

### Email Format (Legacy)
- Pattern: Standard email with @ symbol
- Example: `john.doe@example.com`
- Case: Always lowercase (legacy)

### Database Field
```javascript
assignedTo: {
  type: String,
  uppercase: true,  // NEW: was lowercase
  trim: true,
}
```

## Support

For issues or questions:
1. Check the migration script output for failed cases
2. Verify user exists with the email address
3. Manually update problem cases via MongoDB if needed
4. Contact development team with caseId and details

## Related Files
- Case Model: `src/models/Case.model.js`
- Case Controller: `src/controllers/case.controller.js`
- Search Controller: `src/controllers/search.controller.js`
- Reports Controller: `src/controllers/reports.controller.js`
- Migration Script: `src/scripts/migrateAssignedToXID.js`
