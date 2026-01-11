# Firm-Client-Admin Integrity Fix Scripts

This directory contains scripts to diagnose and fix data integrity issues in the Docketra multi-tenant system.

## Problem Overview

The Docketra system enforces a strict hierarchy:

```
Firm → Default Client → Admin Users
```

**Non-negotiable invariant:**
- Each firm MUST have exactly one default client (internal client)
- Every admin MUST reference the default client of their firm
- Admin's `defaultClientId` MUST match firm's `defaultClientId`

### Symptoms of Integrity Issues

1. **Repeated auto-repair on login** - Admin defaultClientId gets "fixed" on every login
2. **Bootstrap integrity warnings** - Server startup logs warnings about missing clients
3. **System integrity emails** - SuperAdmin receives alerts about data inconsistencies
4. **Login failures** - Admins cannot log in due to missing defaultClientId
5. **Mongoose index warnings** - Duplicate index definitions in models

## Scripts

### 1. Validation Script (Run First)

**Purpose:** Diagnose integrity issues before attempting fixes

```bash
node scripts/validate-integrity-fixes.js
```

**What it checks:**
- ✓ All firms have defaultClientId
- ✓ All admins have defaultClientId
- ✓ Admin defaultClientId matches firm defaultClientId
- ✓ Completed firms have default clients
- ✓ Each firm has exactly one internal client
- ⚠ No pending firm bootstraps

**Exit codes:**
- `0` - All checks passed, system is healthy
- `1` - One or more checks failed, migration needed

**Output:**
- Clear summary of issues found
- Guidance on next steps

### 2. Migration Script (Run After Validation Fails)

**Purpose:** Fix all integrity issues atomically

```bash
node scripts/migrate-fix-firm-client-integrity.js
```

**What it does:**
1. Scans for firms missing defaultClientId
2. Creates system-owned default client for each firm
3. Links firm to default client
4. Backfills ALL admins in firm with correct defaultClientId
5. Validates fixes were applied successfully

**Safety features:**
- ✓ Read-only preview before applying changes
- ✓ Requires explicit confirmation (type "yes")
- ✓ Uses MongoDB transactions for atomicity
- ✓ Idempotent - safe to run multiple times
- ✓ Validates results after migration
- ✓ Detailed logging of all changes

**Migration flow:**

```
Step 1: Scan database
  └─> Find firms without defaultClientId
  └─> Find admins without defaultClientId
  
Step 2: Analysis Report
  └─> Show what will be fixed
  └─> Prompt for confirmation
  
Step 3: Apply Fixes (per firm, in transaction)
  └─> Create default client (or use existing internal client)
  └─> Link firm.defaultClientId → client
  └─> Set firm.bootstrapStatus = COMPLETED
  └─> Backfill all admins in firm
  
Step 4: Validation
  └─> Verify no firms missing defaultClientId
  └─> Verify no admins missing defaultClientId
```

### 3. Legacy Admin Migration (Optional)

**Purpose:** Standalone script for backfilling admins (if firm already has client)

```bash
node scripts/migrate-legacy-admin-default-client.js
```

This is a subset of the comprehensive migration script. Use the comprehensive script instead for complete fixes.

## Recommended Workflow

### Initial Diagnosis

```bash
# 1. Check current state
node scripts/validate-integrity-fixes.js

# If validation fails, proceed to migration
```

### Fix Integrity Issues

```bash
# 2. Run migration (interactive)
node scripts/migrate-fix-firm-client-integrity.js

# 3. Confirm when prompted (type "yes")

# 4. Validate fixes were applied
node scripts/validate-integrity-fixes.js
```

### Verify System Health

```bash
# 5. Restart server and check bootstrap logs
npm start

# Expected: No integrity warnings
# Expected: Bootstrap checks pass
```

### Test Admin Login

```bash
# 6. Login as an admin user
# Expected: No auto-repair messages in logs
# Expected: Login succeeds without errors
```

## Code Fixes Applied

The following code changes prevent future integrity issues:

### 1. Removed Duplicate Indexes (Issue #5)

**Models fixed:**
- `Client.model.js` - Removed redundant `{ firmId: 1 }` index
- `Case.model.js` - Removed redundant `{ firmId: 1 }` index
- `User.model.js` - Removed redundant `{ firmId: 1 }` index
- `Attachment.model.js` - Removed redundant `{ firmId: 1 }` index
- `Task.js` - Removed redundant `{ firmId: 1 }` index
- `ClientAudit.model.js` - Removed redundant `{ firmId: 1 }` index

**Why:** Single-field indexes are redundant when compound indexes exist (e.g., `{ firmId: 1, clientId: 1 }`)

**Result:** MongoDB starts without index warnings

### 2. Added Guardrails (Issue #6)

**Firm.model.js:**
```javascript
// Prevents marking firm as COMPLETED without defaultClientId
firmSchema.pre('save', function(next) {
  if (this.bootstrapStatus === 'COMPLETED' && !this.defaultClientId) {
    return next(new Error('Cannot mark firm as COMPLETED without defaultClientId'));
  }
  next();
});
```

**User.model.js:**
```javascript
// Prevents saving Admin without defaultClientId (except during transactions)
userSchema.pre('save', async function() {
  if (this.role === 'Admin' && !this.isNew && !this.defaultClientId) {
    throw new Error('Cannot save Admin user without defaultClientId');
  }
});
```

**Why:** Prevents accidental creation of incomplete firm hierarchies

**Result:** Developers get clear errors if they violate hierarchy invariants

### 3. SuperAdmin Audit Logging (Issue #4)

**Already fixed in codebase:**
- `SuperadminAudit.model.js` has `performedBySystem` flag
- `logSuperadminAction()` handles "SUPERADMIN" string correctly
- Sets `performedById: null` and `performedBySystem: true` for system actions
- No ObjectId cast errors

### 4. Login Auto-Repair (Issue #1)

**Already correct in codebase:**
- Uses `User.updateOne()` to persist defaultClientId
- Updates in-memory user object after database update
- Only triggers once per admin (until migration fixes root cause)

**Root cause:** Firms missing defaultClientId (fixed by migration)

## Troubleshooting

### Migration Fails Mid-Process

**Problem:** Transaction aborts during migration

**Solution:**
- Check MongoDB logs for errors
- Verify MongoDB supports transactions (requires replica set)
- Run migration again (it's idempotent)

### Validation Fails After Migration

**Problem:** Some issues remain after migration

**Possible causes:**
1. Admins without firmId (orphaned users)
2. Firms created during migration run
3. Manual edits to database

**Solution:**
- Review validation output for specific issues
- Fix orphaned users manually or delete them
- Re-run migration script

### Bootstrap Still Shows Warnings

**Problem:** Server startup logs integrity warnings

**Solution:**
1. Run validation script to confirm fixes
2. Check bootstrap logs for specific issues
3. Restart server (may need fresh bootstrap)

### Login Auto-Repair Still Triggers

**Problem:** Admins get "auto-repaired" on every login

**Solution:**
- Check admin's `defaultClientId` in database
- Verify firm has `defaultClientId`
- Run migration script if values are missing

## Success Criteria

After running migration and validation, the system should have:

- ✅ **Zero bootstrap integrity warnings**
- ✅ **Zero system integrity emails**
- ✅ **Admin login succeeds without auto-repair**
- ✅ **Firm creation audit logs succeed**
- ✅ **MongoDB starts without index warnings**
- ✅ **Each firm has exactly one default client**
- ✅ **Each admin correctly scoped to their firm**

## When to Run

### Development/Staging

Run validation regularly:
```bash
# After pulling latest code
node scripts/validate-integrity-fixes.js

# After creating test firms
node scripts/validate-integrity-fixes.js
```

### Production

Run migration during maintenance window:
```bash
# 1. Backup database
# 2. Run validation
node scripts/validate-integrity-fixes.js

# 3. If validation fails, run migration
node scripts/migrate-fix-firm-client-integrity.js

# 4. Validate fixes
node scripts/validate-integrity-fixes.js

# 5. Restart server
npm start
```

## Support

If you encounter issues not covered here:

1. Check validation output for specific errors
2. Review migration logs for transaction failures
3. Verify MongoDB configuration (replica set for transactions)
4. Check server logs for additional context

---

**Last Updated:** 2026-01-11
**Script Version:** 1.0.0
**Applies To:** Docketra v1.0.0+
