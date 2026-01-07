# Reports & MIS Quick Reference

## 🚀 Quick Start

### Backend API
All report endpoints require **Admin authentication** via `x-user-id` header.

```bash
# Base URL
http://localhost:3000/api/reports

# Case Metrics
GET /case-metrics?fromDate=2026-01-01&toDate=2026-12-31

# Pending Cases
GET /pending-cases?category=Tax%20Compliance

# Cases by Date (required: fromDate, toDate)
GET /cases-by-date?fromDate=2026-01-01&toDate=2026-12-31&page=1&limit=50

# Export CSV
GET /export/csv?fromDate=2026-01-01&toDate=2026-12-31

# Export Excel
GET /export/excel?fromDate=2026-01-01&toDate=2026-12-31
```

### Frontend UI
Admin users only:
- **Dashboard:** `/admin/reports`
- **Detailed Reports:** `/admin/reports/detailed`

---

## 📊 Features

### Reports Dashboard
- **Total Cases** - Count by status (Open/Pending/Closed/Filed)
- **Pending Cases** - Ageing breakdown (0-7, 8-30, 30+ days)
- **Top Categories** - Top 5 categories by volume
- **Top Clients** - Top 5 clients by case count
- **Top Employees** - Top 5 employees by assignments

### Detailed Reports
- **Filters:** Date range, status, category
- **Table View:** All case details with pagination
- **Exports:** CSV and Excel downloads
- **Navigation:** Click rows to view cases (read-only)

---

## 🔐 Security

✅ **Admin-only access** - Enforced at UI and API level  
✅ **Read-only** - No data mutations possible  
✅ **No lifecycle transitions** - Status changes disabled  
✅ **No comments/attachments** - Case view is read-only  

---

## 📖 Full Documentation

- **Testing Guide:** `REPORTS_TESTING_GUIDE.md`
- **Implementation Details:** `REPORTS_IMPLEMENTATION_SUMMARY.md`

---

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| "Authentication required" | Add `x-user-id` header with admin xID |
| "Admin access required" | Verify user has Admin role in database |
| "fromDate and toDate required" | Provide both dates for date-range endpoints |
| UI shows "Access Denied" | Ensure logged-in user is Admin |
| Export downloads empty | Verify filters match existing data |

---

## ✅ Testing Checklist

- [ ] Backend: All 5 endpoints work with admin xID
- [ ] Backend: Non-admin receives 403 error
- [ ] Frontend: Dashboard displays metrics
- [ ] Frontend: Detailed reports filters work
- [ ] Frontend: CSV export downloads correctly
- [ ] Frontend: Excel export downloads correctly
- [ ] Frontend: Non-admin cannot access reports UI
- [ ] Security: No mutation paths exist

---

**For detailed testing instructions, see `REPORTS_TESTING_GUIDE.md`**
