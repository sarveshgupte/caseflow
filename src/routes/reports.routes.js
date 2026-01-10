const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { requireAdmin, blockSuperadmin } = require('../middleware/permission.middleware');
const {
  getCaseMetrics,
  getPendingCasesReport,
  getCasesByDateRange,
  exportCasesCSV,
  exportCasesExcel,
} = require('../controllers/reports.controller');

/**
 * Reports Routes for Docketra Case Management System
 * 
 * All report routes require authentication and admin role
 * Reports are strictly read-only - no data mutation allowed
 * SuperAdmin is blocked from accessing firm-specific reports
 */

// All report routes require authentication and admin role
router.use(authenticate);
router.use(blockSuperadmin);
router.use(requireAdmin);

// Case metrics aggregation
router.get('/case-metrics', getCaseMetrics);

// Pending cases report with ageing
router.get('/pending-cases', getPendingCasesReport);

// Cases by date range with pagination
router.get('/cases-by-date', getCasesByDateRange);

// Export routes
router.get('/export/csv', exportCasesCSV);
router.get('/export/excel', exportCasesExcel);

module.exports = router;
