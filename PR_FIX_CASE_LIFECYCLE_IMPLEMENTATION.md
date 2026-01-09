# Case Lifecycle System Fix - Implementation Summary

## 📌 Overview

This PR implements a comprehensive fix for the Case Lifecycle system (Pend, Resolve, File, Unpend) with proper state transitions, prevents case disappearance from the UI, adds Resolved Cases view, and enables manual unpend capability.

## 🎯 Objectives Achieved

✅ Make **Pend, Resolve, File, Unpend** work reliably together  
✅ Prevent cases from **disappearing from the UI**  
✅ Introduce **Resolved Cases** as a first-class, visible state  
✅ Allow users to **manually unpend** pended cases  
✅ Enforce lifecycle correctness centrally  
✅ Keep UX predictable and auditable

---

## 🔧 Backend Changes

### 1. Central Lifecycle Guard (`src/services/caseAction.service.js`)

**Updated State Transition Map:**

```javascript
const CASE_TRANSITIONS = {
  OPEN: ['PENDED', 'FILED', 'RESOLVED'],
  PENDING: ['OPEN', 'RESOLVED', 'FILED'],  // Can unpend to OPEN
  PENDED: ['OPEN', 'RESOLVED', 'FILED'],   // Can unpend to OPEN
  FILED: [],                                // Terminal state
  RESOLVED: [],                             // Terminal state
  UNASSIGNED: ['OPEN', 'PENDED', 'FILED', 'RESOLVED'],
};
```

**Key Changes:**
- ✅ Added `PENDING → OPEN` and `PENDED → OPEN` transitions for manual unpend
- ✅ Terminal states (FILED, RESOLVED) cannot transition to any other state
- ✅ Centralized transition validation via `assertCaseTransition()`

### 2. New Unpend Service Function

**Location:** `src/services/caseAction.service.js`

```javascript
const unpendCase = async (caseId, comment, user) => {
  validateComment(comment);
  
  const caseData = await Case.findOne({ caseId });
  if (!caseData) throw new Error('Case not found');
  
  // Validate state transition
  assertCaseTransition(caseData.status, CASE_STATUS.OPEN);
  
  // Update case status
  caseData.status = CASE_STATUS.OPEN;
  caseData.pendingUntil = null;
  caseData.pendedByXID = null;
  caseData.lastActionByXID = user.xID;
  caseData.lastActionAt = new Date();
  
  await caseData.save();
  
  // Add comment and audit trail
  await Comment.create({ ... });
  await recordAction('CASE_UNPENDED', ...);
  
  return caseData;
};
```

**Features:**
- ✅ Mandatory comment validation
- ✅ State transition validation
- ✅ Clears `pendingUntil` and `pendedByXID`
- ✅ Creates audit trail with `CASE_UNPENDED` action

### 3. Unpend Controller (`src/controllers/case.controller.js`)

**Updated to use centralized service:**

```javascript
const unpendCase = async (req, res) => {
  try {
    const { caseId } = req.params;
    const { comment } = req.body;
    
    if (!req.user || !req.user.xID) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    const caseData = await caseActionService.unpendCase(caseId, comment, req.user);
    
    res.json({ success: true, data: caseData });
  } catch (error) {
    // Handle specific errors
    if (error.message.startsWith('Cannot change case from')) {
      return res.status(400).json({ message: error.message });
    }
    ...
  }
};
```

### 4. Resolved Cases Endpoints

#### User Endpoint: `GET /api/cases/my-resolved`

**Location:** `src/controllers/caseActions.controller.js`

```javascript
const getMyResolvedCases = async (req, res) => {
  const query = {
    status: CASE_STATUS.RESOLVED,
    lastActionByXID: req.user.xID,  // Cases resolved by this user
  };
  
  const cases = await Case.find(query)
    .select('caseId caseName category createdAt updatedAt status clientId lastActionAt')
    .sort({ lastActionAt: -1 })
    .lean();
  
  // Log audit trail
  await logCaseListViewed({ ... });
  
  res.json({ success: true, data: cases });
};
```

#### Admin Endpoint: `GET /api/admin/cases/resolved`

**Location:** `src/controllers/admin.controller.js`

```javascript
const getAllResolvedCases = async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  
  const cases = await Case.find({ status: CASE_STATUS.RESOLVED })
    .select('caseId caseName category createdAt updatedAt status clientId lastActionByXID lastActionAt')
    .sort({ lastActionAt: -1 })
    .limit(parseInt(limit))
    .skip((parseInt(page) - 1) * parseInt(limit))
    .lean();
  
  const total = await Case.countDocuments({ status: CASE_STATUS.RESOLVED });
  
  // Log admin action
  await logAdminAction({ actionType: 'ADMIN_RESOLVED_CASES_VIEWED', ... });
  
  res.json({ success: true, data: cases, pagination: { ... } });
};
```

### 5. Admin Stats Update

**Location:** `src/controllers/admin.controller.js`

Added `resolvedCases` count to admin dashboard stats:

```javascript
const getAdminStats = async (req, res) => {
  const [
    totalUsers,
    totalClients,
    totalCategories,
    pendingApprovals,
    allOpenCases,
    allPendingCases,
    filedCases,
    resolvedCases,  // ✅ NEW
  ] = await Promise.all([
    User.countDocuments({}),
    Client.countDocuments({}),
    Category.countDocuments({}),
    Case.countDocuments({ status: { $in: [CASE_STATUS.REVIEWED, CASE_STATUS.UNDER_REVIEW] }}),
    Case.countDocuments({ status: CASE_STATUS.OPEN }),
    Case.countDocuments({ status: CASE_STATUS.PENDED }),
    Case.countDocuments({ status: CASE_STATUS.FILED }),
    Case.countDocuments({ status: CASE_STATUS.RESOLVED }),  // ✅ NEW
  ]);
  
  res.json({ success: true, data: { ..., resolvedCases } });
};
```

### 6. Audit Log Updates (`src/models/CaseAudit.model.js`)

**Added new action types:**

```javascript
enum: [
  'CASE_VIEWED',
  'CASE_COMMENT_ADDED',
  'CASE_FILE_ATTACHED',
  'CASE_CLOSED_VIEWED',
  'CASE_EDITED',
  'CASE_ASSIGNED',
  'CASE_UNASSIGNED',
  'CASE_STATUS_CHANGED',
  'CASE_LIST_VIEWED',
  'ADMIN_FILED_CASES_VIEWED',
  'ADMIN_APPROVAL_QUEUE_VIEWED',
  'CASE_ATTACHMENT_ADDED',
  'CASE_PENDED',         // ✅ NEW
  'CASE_UNPENDED',       // ✅ NEW
  'CASE_RESOLVED',       // ✅ NEW
  'CASE_FILED',          // ✅ NEW
  'CASE_AUTO_REOPENED',  // ✅ NEW
]
```

### 7. Route Updates

**Added routes:**

- `GET /api/cases/my-resolved` - User's resolved cases
- `GET /api/admin/cases/resolved` - Admin view of all resolved cases

**Updated imports:**

- `src/routes/case.routes.js` - Added `getMyResolvedCases`
- `src/routes/admin.routes.js` - Added `getAllResolvedCases`

---

## 🎨 Frontend Changes

### 1. Case Detail Page Button Visibility (`ui/src/pages/CaseDetailPage.jsx`)

**Canonical Action Visibility Rules:**

| Case Status      | File | Pend | Resolve | Unpend |
|-----------------|------|------|---------|--------|
| OPEN            | ✅    | ✅    | ✅       | ❌      |
| PENDING/PENDED  | ❌    | ❌    | ❌       | ✅      |
| FILED           | ❌    | ❌    | ❌       | ❌      |
| RESOLVED        | ❌    | ❌    | ❌       | ❌      |

**Implementation:**

```javascript
// Action Visibility Logic
const canPerformLifecycleActions = caseInfo.status === 'OPEN' && !isViewOnlyMode;
const canUnpend = (caseInfo.status === 'PENDED' || caseInfo.status === 'PENDING') && !isViewOnlyMode;
const isTerminalState = caseInfo.status === 'FILED' || caseInfo.status === 'RESOLVED';

// Render buttons conditionally
{canPerformLifecycleActions && (
  <>
    <Button onClick={() => setShowFileModal(true)}>File</Button>
    <Button onClick={() => setShowPendModal(true)}>Pend</Button>
    <Button onClick={() => setShowResolveModal(true)}>Resolve</Button>
  </>
)}

{canUnpend && (
  <Button onClick={() => setShowUnpendModal(true)}>Unpend</Button>
)}
```

### 2. Unpend Modal

**New modal component:**

```jsx
<Modal
  isOpen={showUnpendModal}
  onClose={() => {
    setShowUnpendModal(false);
    setUnpendComment('');
  }}
  title="Unpend Case"
  actions={
    <>
      <Button variant="default" onClick={...}>Cancel</Button>
      <Button 
        variant="primary" 
        onClick={handleUnpendCase}
        disabled={!unpendComment.trim() || unpendingCase}
      >
        {unpendingCase ? 'Unpending...' : 'Unpend Case'}
      </Button>
    </>
  }
>
  <div style={{ padding: 'var(--spacing-md)' }}>
    <p style={{ marginBottom: 'var(--spacing-md)', color: 'var(--text-secondary)' }}>
      Unpending a case will move it back to OPEN status and return it to your worklist.
      Use this when you no longer need to wait for external input.
    </p>
    <Textarea
      label="Comment (Required)"
      value={unpendComment}
      onChange={(e) => setUnpendComment(e.target.value)}
      placeholder="Explain why this case is being unpended..."
      rows={4}
      required
      disabled={unpendingCase}
    />
  </div>
</Modal>
```

**Handler:**

```javascript
const handleUnpendCase = async () => {
  if (!unpendComment.trim()) {
    showWarning('Comment is mandatory for unpending a case');
    return;
  }

  setUnpendingCase(true);
  try {
    const response = await caseService.unpendCase(caseId, unpendComment);
    
    if (response.success) {
      showSuccess('Case unpended successfully');
      setShowUnpendModal(false);
      setUnpendComment('');
      await loadCase(); // Reload to update UI
    }
  } catch (error) {
    const serverMessage = error.response?.data?.message;
    const errorMessage = serverMessage && typeof serverMessage === 'string'
      ? serverMessage.substring(0, 200)
      : 'Failed to unpend case. Please try again.';
    showError(errorMessage);
  } finally {
    setUnpendingCase(false);
  }
};
```

### 3. Dashboard Updates (`ui/src/pages/DashboardPage.jsx`)

**Added Resolved Cases Cards:**

```jsx
// User Card
<Card 
  className="dashboard__stat-card dashboard__stat-card--clickable" 
  onClick={handleMyResolvedCasesClick}
>
  <div className="dashboard__stat-value">{stats.myResolvedCases}</div>
  <div className="dashboard__stat-label">My Resolved Cases</div>
  <div className="dashboard__stat-description text-secondary">
    Successfully completed
  </div>
</Card>

// Admin Card (if isAdmin)
<Card 
  className="dashboard__stat-card dashboard__stat-card--admin dashboard__stat-card--clickable" 
  onClick={handleAdminResolvedCasesClick}
>
  <div className="dashboard__stat-value">{stats.adminResolvedCases}</div>
  <div className="dashboard__stat-label">All Resolved Cases</div>
  <div className="dashboard__stat-description text-secondary">
    All completed cases
  </div>
</Card>
```

**Load resolved cases data:**

```javascript
// Get My Resolved Cases count
try {
  const resolvedResponse = await caseService.getMyResolvedCases();
  if (resolvedResponse.success) {
    const resolvedCases = resolvedResponse.data || [];
    setStats((prev) => ({
      ...prev,
      myResolvedCases: resolvedCases.length,
    }));
  }
} catch (error) {
  console.error('Failed to load resolved cases:', error);
}

// Admin - Get all resolved cases count
if (isAdmin) {
  try {
    const adminResolvedResponse = await adminService.getAllResolvedCases();
    if (adminResolvedResponse.success) {
      setStats((prev) => ({
        ...prev,
        adminResolvedCases: adminResolvedResponse.pagination?.total || 0,
      }));
    }
  } catch (error) {
    console.error('Failed to load admin resolved cases:', error);
  }
}
```

**Navigation handlers:**

```javascript
const handleMyResolvedCasesClick = () => {
  navigate('/my-worklist?status=RESOLVED');
};

const handleAdminResolvedCasesClick = () => {
  navigate('/cases?status=RESOLVED');
};
```

### 4. Service Layer Updates

#### `ui/src/services/caseService.js`

**Added methods:**

```javascript
/**
 * Unpend a case with mandatory comment
 * Changes status from PENDED back to OPEN (manual unpend)
 */
unpendCase: async (caseId, comment) => {
  const response = await api.post(`/cases/${caseId}/unpend`, { comment });
  return response.data;
},

/**
 * Get my resolved cases
 * Returns cases with status RESOLVED that were resolved by current user
 */
getMyResolvedCases: async () => {
  const response = await api.get('/cases/my-resolved');
  return response.data;
},
```

#### `ui/src/services/adminService.js`

**Added method:**

```javascript
/**
 * Get all resolved cases (Admin view)
 * Returns all cases with status RESOLVED
 */
getAllResolvedCases: async (params = {}) => {
  const queryParams = new URLSearchParams(params).toString();
  const response = await api.get(`/admin/cases/resolved${queryParams ? '?' + queryParams : ''}`);
  return response.data;
},
```

---

## ✅ Acceptance Criteria Met

| Criterion | Status | Notes |
|-----------|--------|-------|
| Pend, Resolve, File, Unpend work together | ✅ | All actions use centralized transition validation |
| No invalid transitions possible | ✅ | `assertCaseTransition()` enforces rules |
| Cases never disappear | ✅ | Resolved cases visible in dedicated views |
| Resolved cases visible and accessible | ✅ | User and admin endpoints + dashboard cards |
| Manual unpend capability | ✅ | New unpend service, controller, and UI modal |
| Dashboard counts accurate | ✅ | Counts match actual case queries |
| Terminal states immutable | ✅ | FILED and RESOLVED have no outgoing transitions |
| Full audit trail | ✅ | All actions logged with CASE_* action types |

---

## 🚀 Dashboard & Worklist Visibility Matrix

| Status   | Visible Where                                              |
|----------|-----------------------------------------------------------|
| OPEN     | Dashboard "My Open Cases", My Worklist                    |
| PENDED   | Dashboard "My Pending Cases", Pending Cases View          |
| FILED    | Admin → "Filed Cases" dashboard card, Admin Filed List    |
| RESOLVED | Users → "My Resolved Cases" dashboard<br>Admins → "All Resolved Cases" dashboard |

---

## 📋 API Contract Summary

### User Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/cases/:caseId/pend` | Pend case (comment + reopenDate required) |
| POST | `/api/cases/:caseId/unpend` | Unpend case (comment required) |
| POST | `/api/cases/:caseId/resolve` | Resolve case (comment required) |
| POST | `/api/cases/:caseId/file` | File case (comment required) |
| GET | `/api/cases/my-pending` | Get user's pending cases |
| GET | `/api/cases/my-resolved` | Get user's resolved cases |

### Admin Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/stats` | Dashboard stats (includes resolvedCases count) |
| GET | `/api/admin/cases/open` | All open cases (admin view) |
| GET | `/api/admin/cases/pending` | All pending cases (admin view) |
| GET | `/api/admin/cases/filed` | All filed cases (admin view) |
| GET | `/api/admin/cases/resolved` | All resolved cases (admin view) |

---

## 🔐 Security Considerations

### Authentication & Authorization
- ✅ All lifecycle endpoints require authentication (`req.user` validation)
- ✅ xID-based attribution for all actions
- ✅ Admin endpoints protected with `requireAdmin` middleware

### Audit Trail
- ✅ All lifecycle actions logged to `CaseAudit` collection
- ✅ Immutable audit log (no updates or deletes allowed)
- ✅ Captures actor xID, timestamp, action type, and metadata

### Input Validation
- ✅ Mandatory comment validation for all lifecycle actions
- ✅ State transition validation via centralized guard
- ✅ Date validation for pend reopen dates

### Error Handling
- ✅ Descriptive error messages for invalid transitions
- ✅ Specific error codes for different failure scenarios
- ✅ Sanitized error messages in frontend (length limited)

---

## 📊 Testing Recommendations

### Backend Tests

1. **State Transition Tests**
   - ✅ Test valid transitions (OPEN → PENDED, OPEN → RESOLVED, OPEN → FILED)
   - ✅ Test unpend transition (PENDED → OPEN)
   - ✅ Test terminal state enforcement (FILED/RESOLVED cannot transition)

2. **Validation Tests**
   - ✅ Test missing comment rejection
   - ✅ Test invalid state transition rejection
   - ✅ Test authentication requirement

3. **Audit Trail Tests**
   - ✅ Verify audit logs created for all actions
   - ✅ Verify correct action types logged

### Frontend Tests

1. **Button Visibility Tests**
   - ✅ OPEN: File, Pend, Resolve buttons visible
   - ✅ PENDED: Only Unpend button visible
   - ✅ FILED/RESOLVED: No action buttons visible

2. **Modal Tests**
   - ✅ Unpend modal opens and closes correctly
   - ✅ Comment validation works
   - ✅ Success/error messages display

3. **Dashboard Tests**
   - ✅ Resolved cases card displays correct count
   - ✅ Navigation to resolved cases list works

---

## 🎉 Summary

This PR delivers a **complete, auditable, and predictable case lifecycle system** with:

✅ **Centralized lifecycle enforcement** - No scattered status checks  
✅ **Manual unpend capability** - Users can unpend cases before auto-reopen  
✅ **Resolved cases visibility** - First-class view for completed cases  
✅ **Proper button visibility** - Actions only available in valid states  
✅ **Full audit trail** - Every lifecycle action logged  
✅ **No case disappearance** - Every status has a visible bucket  

The implementation follows the canonical lifecycle defined in the requirements and ensures system stability, auditability, and user experience consistency.
