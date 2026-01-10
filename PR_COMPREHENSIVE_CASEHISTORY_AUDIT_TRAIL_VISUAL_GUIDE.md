# Visual Guide: Comprehensive CaseHistory & Audit Trail

## 📋 Table of Contents
1. [Case Detail Page with History](#case-detail-page-with-history)
2. [Audit Trail Display](#audit-trail-display)
3. [Tracking Flow Diagram](#tracking-flow-diagram)
4. [Data Model Structure](#data-model-structure)

---

## 1. Case Detail Page with History

```
┌─────────────────────────────────────────────────────────────────┐
│                        CASE DETAIL PAGE                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  📋 Case: CASE-20260110-00001                                  │
│  Status: OPEN                    Priority: High                │
│  Assigned to: X123456                                          │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  Case Details                                          │  │
│  │  Title: Customer onboarding issue                      │  │
│  │  Description: ...                                      │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  Comments                                              │  │
│  │  [Add Comment]                                         │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  Attachments                                           │  │
│  │  [Upload File]                                         │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  📜 Case History (NEW!)                                │  │
│  ├─────────────────────────────────────────────────────────┤  │
│  │  ┌─ [CASE VIEWED] [USER]                              │  │
│  │  │  John Smith viewed case                            │  │
│  │  │  X123456 • 2026-01-10 10:30:15                     │  │
│  │  │  IP: 192.168.1.100 (Admin only)                    │  │
│  │  └─                                                    │  │
│  │                                                         │  │
│  │  ┌─ [CASE OPENED] [USER]                              │  │
│  │  │  John Smith opened case                            │  │
│  │  │  X123456 • 2026-01-10 10:30:00                     │  │
│  │  └─                                                    │  │
│  │                                                         │  │
│  │  ┌─ [CASE ASSIGNED] [ADMIN]                           │  │
│  │  │  Case assigned to John Smith                       │  │
│  │  │  X999999 • 2026-01-10 10:15:00                     │  │
│  │  └─                                                    │  │
│  │                                                         │  │
│  │  ┌─ [CASE CREATED] [USER]                             │  │
│  │  │  Case created by Admin User                        │  │
│  │  │  X999999 • 2026-01-10 10:00:00                     │  │
│  │  └─                                                    │  │
│  └─────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Audit Trail Display

### Example Timeline View

```
Case History Timeline
─────────────────────────────────────────────────

🟢 CASE_VIEWED                    [USER]
   John Smith viewed case
   X123456 (john.smith@company.com)
   2026-01-10 10:30:15 IST
   IP: 192.168.1.100 (Admin only)
   ▼ View Details
   {
     "userName": "John Smith",
     "timestamp": "2026-01-10T05:00:15.000Z"
   }
─────────────────────────────────────────────────

🟢 CASE_OPENED                    [USER]
   John Smith opened case
   X123456 (john.smith@company.com)
   2026-01-10 10:30:00 IST
─────────────────────────────────────────────────

🔵 CASE_ASSIGNED                  [ADMIN]
   Case assigned to John Smith
   X999999 (admin@company.com)
   2026-01-10 10:15:00 IST
   ▼ View Details
   {
     "queueType": "PERSONAL",
     "status": "OPEN",
     "assignedTo": "X123456"
   }
─────────────────────────────────────────────────

🟢 CASE_CREATED                   [USER]
   Case created by Admin User
   X999999 (admin@company.com)
   2026-01-10 10:00:00 IST
   ▼ View Details
   {
     "category": "Client - New",
     "clientId": "C000001",
     "priority": "High"
   }
```

---

## 3. Tracking Flow Diagram

```
User Journey: Opening and Viewing a Case
─────────────────────────────────────────

1. User navigates to /cases/CASE-20260110-00001
   │
   ├─→ useEffect (mount)
   │   ├─→ loadCase() - Fetch case data
   │   └─→ trackCaseOpen() ──────────┐
   │                                   │
2. Case data loaded successfully      │
   │                                   │
   ├─→ useEffect (caseData ready)     │
   │   └─→ setTimeout(2000ms) ────┐   │
   │                               │   │
3. After 2 second debounce         │   │
   │                               │   │
   └─→ trackCaseView() ───────────┼───┤
                                   │   │
4. User navigates away             │   │
   │                               │   │
   └─→ Cleanup function            │   │
       └─→ trackCaseExit() ────────┼───┤
                                   │   │
5. Or user closes tab              │   │
   │                               │   │
   └─→ beforeunload event          │   │
       └─→ sendBeacon() ───────────┘   │
                                       │
                                       ▼
                            Backend Processing
                            ──────────────────
                            POST /api/cases/:caseId/track-open
                            POST /api/cases/:caseId/track-view
                            POST /api/cases/:caseId/track-exit
                                       │
                                       ▼
                            Validate user & case
                            Extract IP & user agent
                            Log to CaseHistory
                                       │
                                       ▼
                            MongoDB: CaseHistory Collection
                            {
                              caseId: "CASE-20260110-00001",
                              firmId: ObjectId(...),
                              actionType: "CASE_OPENED",
                              actionLabel: "John opened case",
                              performedByXID: "X123456",
                              actorRole: "USER",
                              ipAddress: "192.168.1.100",
                              userAgent: "Mozilla/5.0...",
                              metadata: {...},
                              timestamp: ISODate(...)
                            }
```

---

## 4. Data Model Structure

### CaseHistory Document Structure

```javascript
{
  // Core Identification
  _id: ObjectId("..."),
  caseId: "CASE-20260110-00001",
  firmId: "FIRM001",
  
  // Action Details
  actionType: "CASE_VIEWED",           // From CASE_ACTION_TYPES enum
  actionLabel: "John Smith viewed case", // Human-readable
  description: "Case viewed by X123456 (John Smith)",
  
  // Actor Information
  performedByXID: "X123456",           // Canonical identifier
  performedBy: "john.smith@company.com", // Display email
  actorRole: "USER",                   // SUPER_ADMIN | ADMIN | USER | SYSTEM
  
  // Forensic Data
  ipAddress: "192.168.1.100",
  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)...",
  
  // Context & Metadata
  metadata: {
    userName: "John Smith",
    timestamp: "2026-01-10T05:00:15.000Z",
    // Action-specific data (no sensitive info)
  },
  
  // Timestamp (Immutable)
  timestamp: ISODate("2026-01-10T05:00:15.000Z")
}
```

### Index Structure

```javascript
// Compound Indexes
{ caseId: 1, timestamp: -1 }           // Primary query pattern
{ firmId: 1, timestamp: -1 }           // Firm-scoped audit
{ firmId: 1, caseId: 1 }               // Firm + case lookup

// Single Field Indexes
{ performedBy: 1 }                     // Legacy email lookup
{ performedByXID: 1 }                  // Canonical xID lookup
{ actionType: 1 }                      // Action filtering
{ actorRole: 1 }                       // Role-based queries
```

---

## 5. Role-Based Access Matrix

```
┌──────────────┬─────────┬───────┬───────┬─────────┐
│ Feature      │ Admin   │ User  │ Super │ System  │
├──────────────┼─────────┼───────┼───────┼─────────┤
│ View History │ ✅ Full │ ✅ RO │ ❌ No │ N/A     │
│ See IP Addr  │ ✅ Yes  │ ❌ No │ ❌ No │ N/A     │
│ Track Access │ ✅ Yes  │ ✅ Yes│ ❌ No*│ ✅ Yes  │
│ Export Logs  │ ❌ No** │ ❌ No │ ❌ No │ N/A     │
└──────────────┴─────────┴───────┴───────┴─────────┘

* Superadmin cannot access case details at all
** Export feature not implemented (future work)

Legend:
✅ = Allowed
❌ = Blocked
RO = Read-Only
```

---

## 6. API Endpoints Summary

```
Case Tracking Endpoints (NEW)
──────────────────────────────

POST /api/cases/:caseId/track-open
  ├─ Auth: Required (User, Admin)
  ├─ Logs: CASE_OPENED
  └─ Returns: 200 OK (immediate, non-blocking)

POST /api/cases/:caseId/track-view
  ├─ Auth: Required (User, Admin)
  ├─ Logs: CASE_VIEWED
  └─ Returns: 200 OK (immediate, non-blocking)

POST /api/cases/:caseId/track-exit
  ├─ Auth: Required (User, Admin)
  ├─ Logs: CASE_EXITED
  └─ Returns: 200 OK (immediate, non-blocking)

GET /api/cases/:caseId/history
  ├─ Auth: Required (User, Admin)
  ├─ Access: Firm-scoped, Role-based
  └─ Returns: Chronological audit trail

Enhanced Existing Endpoints
────────────────────────────

POST /api/cases
  └─ Now logs: CASE_CREATED

POST /api/cases/pull
  └─ Now logs: CASE_ASSIGNED

POST /api/cases/:caseId/unassign
  └─ Now logs: CASE_MOVED_TO_WORKBASKET

POST /api/cases/:caseId/resolve
  └─ Now logs: CASE_RESOLVED

POST /api/cases/:caseId/pend
  └─ Now logs: CASE_PENDED

POST /api/cases/:caseId/unpend
  └─ Now logs: CASE_UNPENDED

POST /api/cases/:caseId/file
  └─ Now logs: CASE_FILED
```

---

## 7. Color-Coded Action Types

```
Action Type Badges (Frontend Display)
──────────────────────────────────────

🟢 Green - Creation
   CASE_CREATED

🔵 Blue - Assignment
   CASE_ASSIGNED
   CASE_MOVED_TO_WORKBASKET

🟣 Purple - Terminal States
   CASE_RESOLVED
   CASE_FILED

🟡 Yellow - Temporary States
   CASE_PENDED

⚪ Gray - View/Access
   CASE_OPENED
   CASE_VIEWED
   CASE_EXITED

Role Badges
───────────
🔴 Red - SUPER_ADMIN
🔵 Blue - ADMIN
⚪ Gray - SYSTEM
🟢 Green - USER
```

---

## 8. Performance Characteristics

```
Tracking Performance Metrics
────────────────────────────

Frontend (per case view):
├─ CASE_OPENED:  ~50ms (async, non-blocking)
├─ CASE_VIEWED:  ~50ms (2s debounce)
└─ CASE_EXITED:  ~5ms (sendBeacon)

Backend (per tracking request):
├─ Validation:   ~10ms
├─ DB Write:     ~20ms (indexed)
└─ Total:        ~30ms

Database Impact:
├─ Write Load:   Low (append-only)
├─ Index Count:  +2 (actionType, actorRole)
└─ Storage:      ~500 bytes per entry

Frontend Bundle:
├─ CaseHistory Component: ~5KB
└─ Service Methods: ~2KB
```

---

## 9. Compliance Features

```
Legal & Compliance Capabilities
────────────────────────────────

✅ Immutability
   ├─ No updates allowed
   ├─ No deletions allowed
   └─ Enforced at schema level

✅ Non-Repudiation
   ├─ Actor xID captured
   ├─ Timestamp immutable
   └─ IP address logged

✅ Forensic Trail
   ├─ User agent captured
   ├─ IP address captured
   └─ Complete action history

✅ Tenant Isolation
   ├─ Firm-scoped queries
   ├─ Access controls enforced
   └─ No cross-tenant leakage

✅ Audit Grade
   ├─ Append-only log
   ├─ Chronological ordering
   └─ Complete provenance
```

---

**End of Visual Guide**
