# Reports & MIS Testing Guide

This document provides instructions for testing the Reports & MIS functionality for Docketra.

## 🧪 Backend API Testing

### Prerequisites
1. Ensure MongoDB is running and connected
2. Ensure at least one Admin user exists in the database
3. Ensure some test cases exist with various statuses and categories

### Authentication
All report endpoints require:
- Authentication via `x-user-id` header with a valid xID
- Admin role (enforced at route level via `requireAdmin` middleware)

### Test Endpoints

#### 1. Case Metrics (`GET /api/reports/case-metrics`)

**Test with no filters:**
```bash
curl -X GET "http://localhost:3000/api/reports/case-metrics" \
  -H "x-user-id: X123456"
```

**Test with filters:**
```bash
curl -X GET "http://localhost:3000/api/reports/case-metrics?status=Open&fromDate=2026-01-01&toDate=2026-12-31" \
  -H "x-user-id: X123456"
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "totalCases": 150,
    "byStatus": {
      "Open": 45,
      "Pending": 30,
      "Closed": 60,
      "Filed": 15
    },
    "byCategory": {
      "Client - New": 20,
      "Tax Compliance": 50
    },
    "byClient": [
      {
        "clientId": "C123456",
        "clientName": "Acme Corp",
        "count": 25
      }
    ],
    "byEmployee": [
      {
        "email": "john@example.com",
        "name": "John Doe",
        "count": 40
      }
    ]
  }
}
```

#### 2. Pending Cases Report (`GET /api/reports/pending-cases`)

**Test with no filters:**
```bash
curl -X GET "http://localhost:3000/api/reports/pending-cases" \
  -H "x-user-id: X123456"
```

**Test with category filter:**
```bash
curl -X GET "http://localhost:3000/api/reports/pending-cases?category=Tax%20Compliance" \
  -H "x-user-id: X123456"
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "totalPending": 30,
    "byCategory": {
      "Tax Compliance": 15
    },
    "byEmployee": [
      {
        "email": "john@example.com",
        "name": "John Doe",
        "count": 12
      }
    ],
    "byAgeing": {
      "0-7 days": 10,
      "8-30 days": 15,
      "30+ days": 5
    },
    "cases": [
      {
        "caseId": "DCK-0042",
        "caseName": "case2026010700042",
        "title": "Q4 Tax Filing",
        "category": "Tax Compliance",
        "clientName": "Acme Corp",
        "ageingDays": 5,
        "ageingBucket": "0-7 days"
      }
    ]
  }
}
```

#### 3. Cases by Date Range (`GET /api/reports/cases-by-date`)

**Test (fromDate and toDate are required):**
```bash
curl -X GET "http://localhost:3000/api/reports/cases-by-date?fromDate=2026-01-01&toDate=2026-12-31&page=1&limit=50" \
  -H "x-user-id: X123456"
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "cases": [
      {
        "caseId": "DCK-0042",
        "caseName": "case2026010700042",
        "title": "Q4 Tax Filing",
        "status": "Open",
        "category": "Tax Compliance",
        "clientName": "Acme Corp",
        "assignedTo": "john@example.com",
        "createdAt": "2026-01-07T10:30:00.000Z",
        "createdBy": "admin@example.com"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 150,
      "pages": 3
    }
  }
}
```

#### 4. CSV Export (`GET /api/reports/export/csv`)

**Test:**
```bash
curl -X GET "http://localhost:3000/api/reports/export/csv?fromDate=2026-01-01&toDate=2026-12-31" \
  -H "x-user-id: X123456" \
  --output report.csv
```

**Expected:** CSV file downloaded with headers:
```
caseId,caseName,title,status,category,clientId,clientName,assignedTo,createdAt,createdBy
```

#### 5. Excel Export (`GET /api/reports/export/excel`)

**Test:**
```bash
curl -X GET "http://localhost:3000/api/reports/export/excel?fromDate=2026-01-01&toDate=2026-12-31" \
  -H "x-user-id: X123456" \
  --output report.xlsx
```

**Expected:** Excel (.xlsx) file downloaded with "Docketra Cases Report" worksheet

### Security Testing

#### Test Non-Admin Access (Should Return 403)

```bash
# Create or use a non-admin user with xID X654321
curl -X GET "http://localhost:3000/api/reports/case-metrics" \
  -H "x-user-id: X654321"
```

**Expected Response:**
```json
{
  "success": false,
  "message": "Admin access required"
}
```

#### Test Unauthenticated Access (Should Return 401)

```bash
curl -X GET "http://localhost:3000/api/reports/case-metrics"
```

**Expected Response:**
```json
{
  "success": false,
  "message": "Authentication required. Please provide xID."
}
```

---

## 🎨 Frontend UI Testing

### Prerequisites
1. UI built and served (either via `npm run dev` or `npm run build`)
2. Backend API running on http://localhost:3000
3. Admin user credentials available

### Test Flows

#### 1. Admin Login and Navigation
1. Login with admin credentials (e.g., xID: X123456)
2. Navigate to Admin Panel
3. Click "Reports & MIS" tab
4. Should navigate to `/admin/reports` - Reports Dashboard

#### 2. Reports Dashboard (MIS Overview)
**URL:** `/admin/reports`

**Verify:**
- [ ] Total Cases card displays with count and status breakdown
- [ ] Pending Cases card displays with ageing breakdown
- [ ] 30+ days pending cases highlighted in warning color
- [ ] Top Categories table displays top 5 categories
- [ ] Top Clients table displays top 5 clients
- [ ] Pending Cases Ageing table shows buckets (0-7, 8-30, 30+)
- [ ] Top Employees table shows top 5 employees by case count
- [ ] "View Detailed Reports" button navigates to detailed reports page
- [ ] Loading state displays while fetching data
- [ ] Error state displays correctly if user lacks permissions

#### 3. Detailed Reports Page
**URL:** `/admin/reports/detailed`

**Verify Filters Panel:**
- [ ] From Date picker works correctly
- [ ] To Date picker works correctly
- [ ] Status dropdown includes all statuses
- [ ] Category dropdown includes all categories
- [ ] "Apply Filters" button fetches filtered data
- [ ] "Clear Filters" button resets all filters

**Verify Results Table:**
- [ ] Table displays after applying filters with valid date range
- [ ] Columns: Case ID, Case Name, Title, Status, Category, Client Name, Assigned To, Created At
- [ ] Clicking a row navigates to case detail page (`/cases/:caseName`)
- [ ] Pagination controls appear when results exceed page limit
- [ ] "Previous" button disabled on first page
- [ ] "Next" button disabled on last page
- [ ] Page info shows current page/total pages/total records
- [ ] Empty state displays when no data matches filters
- [ ] Error message displays if fromDate/toDate missing

**Verify Export Functionality:**
- [ ] CSV Export button disabled when no cases loaded
- [ ] Excel Export button disabled when no cases loaded
- [ ] Clicking "Export as CSV" opens confirmation modal
- [ ] Clicking "Export as Excel" opens confirmation modal
- [ ] Modal shows applied filters correctly
- [ ] Modal shows estimated record count
- [ ] "Cancel" button closes modal
- [ ] "Confirm Export" triggers download
- [ ] Downloaded CSV file contains correct data
- [ ] Downloaded Excel file contains correct data
- [ ] File name includes date (e.g., `docketra-report-20260107.csv`)

#### 4. Non-Admin User Access Control
**Login with non-admin user (e.g., Employee role)**

**Verify:**
- [ ] Reports & MIS tab NOT visible in Admin Panel
- [ ] Direct navigation to `/admin/reports` shows access denied
- [ ] Direct navigation to `/admin/reports/detailed` shows access denied
- [ ] API calls return 403 Forbidden

#### 5. Case View from Reports (Read-Only)
**From Detailed Reports, click on a case row**

**Verify:**
- [ ] Navigates to case detail page (`/cases/:caseName`)
- [ ] Case details display correctly
- [ ] NO action buttons visible (Edit, Clone, Add Comment, etc.)
- [ ] Status change dropdown NOT editable
- [ ] All fields are read-only
- [ ] User can still view case history, comments, attachments
- [ ] Back button returns to reports page

---

## ✅ Acceptance Checklist

### Backend
- [ ] All 5 report endpoints work correctly
- [ ] Admin-only middleware enforces access control
- [ ] Non-admin users receive 403 errors
- [ ] Unauthenticated requests receive 401 errors
- [ ] Date filters work correctly
- [ ] Status filters work correctly
- [ ] Category filters work correctly
- [ ] Client filters work correctly
- [ ] Employee filters work correctly
- [ ] Pagination works correctly
- [ ] CSV export downloads correctly
- [ ] Excel export downloads correctly
- [ ] Exported data matches UI data exactly

### Frontend
- [ ] Reports Dashboard displays all metrics correctly
- [ ] Detailed Reports page displays filtered results
- [ ] Filters apply correctly across all fields
- [ ] Pagination works correctly
- [ ] Export confirmation modal works correctly
- [ ] CSV downloads with correct filename
- [ ] Excel downloads with correct filename
- [ ] Non-admin users cannot access reports UI
- [ ] Case view from reports is read-only
- [ ] Error states display correctly
- [ ] Loading states display correctly
- [ ] Empty states display correctly

### Security
- [ ] No data mutation possible from reports
- [ ] Admin-only access enforced at UI level
- [ ] Admin-only access enforced at API level
- [ ] Case view from reports has no action buttons
- [ ] Reports cannot change case status
- [ ] Reports cannot add comments
- [ ] Reports cannot add attachments

### Design
- [ ] Neomorphic design consistent with existing UI
- [ ] Metric cards use dual shadows
- [ ] Filter panel uses inset shadow design
- [ ] Table rows have subtle hover effect
- [ ] Export buttons use primary color
- [ ] Warning colors used for overdue cases
- [ ] Loading skeletons display correctly
- [ ] Responsive layout works on mobile

---

## 🐛 Common Issues and Troubleshooting

### Issue: "Authentication required" error
**Solution:** Ensure `x-user-id` header is sent with admin xID

### Issue: "Admin access required" error
**Solution:** Verify user has Admin role in database

### Issue: "fromDate and toDate are required" error
**Solution:** Ensure both date parameters are provided for date-range endpoints

### Issue: Export downloads empty file
**Solution:** Verify filters are applied and data exists for date range

### Issue: UI shows "Access Denied"
**Solution:** Ensure logged-in user has Admin role

### Issue: Case view from reports shows action buttons
**Solution:** This is a bug - case view should be read-only when accessed from reports

---

## 📊 Test Data Requirements

To properly test all features, ensure the following test data exists:

1. **Users:**
   - At least 1 Admin user (xID: X123456)
   - At least 1 Employee user (xID: X654321)

2. **Clients:**
   - At least 5 clients with different names
   - Organization client (C123456)

3. **Cases:**
   - At least 20 cases with various statuses (Open, Pending, Closed, Filed)
   - Cases with different categories
   - Cases assigned to different employees
   - Cases with different creation dates (spread across months)
   - At least 5 Pending cases with different pendingUntil dates

4. **Categories:**
   - Client - New
   - Client - Edit
   - Tax Compliance
   - Audit
   - GST Filing
   - Other

---

## 🔒 Security Validation

**Critical: Verify NO mutation is possible from reports**

1. Attempt to change case status via Reports UI → Should fail
2. Attempt to add comment via Reports UI → Should fail
3. Attempt to add attachment via Reports UI → Should fail
4. Inspect network requests → Should only see GET requests to `/api/reports/*`
5. No POST/PUT/PATCH/DELETE requests from reports pages

---

## 📝 Test Results Log

| Test Case | Status | Notes |
|-----------|--------|-------|
| Backend: Case Metrics API | ⏳ Pending | |
| Backend: Pending Cases API | ⏳ Pending | |
| Backend: Cases by Date API | ⏳ Pending | |
| Backend: CSV Export | ⏳ Pending | |
| Backend: Excel Export | ⏳ Pending | |
| Backend: Admin-only enforcement | ⏳ Pending | |
| Frontend: Reports Dashboard | ⏳ Pending | |
| Frontend: Detailed Reports | ⏳ Pending | |
| Frontend: Export functionality | ⏳ Pending | |
| Frontend: Read-only case view | ⏳ Pending | |
| Security: No mutations possible | ⏳ Pending | |

---

## 📋 Final Sign-Off

- [ ] All backend endpoints tested and working
- [ ] All frontend pages tested and working
- [ ] Admin-only access verified
- [ ] Read-only constraints verified
- [ ] Export functionality verified
- [ ] Data consistency verified (UI matches exports)
- [ ] Security validated (no mutations possible)
- [ ] Design consistency verified
- [ ] Documentation complete

**Tested by:** _______________  
**Date:** _______________  
**Approved by:** _______________  
**Date:** _______________
