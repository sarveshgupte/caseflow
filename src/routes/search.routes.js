const express = require('express');
const router = express.Router();
const { searchLimiter } = require('../middleware/rateLimiters');
const {
  globalSearch,
  categoryWorklist,
  employeeWorklist,
  globalWorklist,
} = require('../controllers/search.controller');

/**
 * Search and Worklist Routes
 * PART A - READ-ONLY operations for finding cases and viewing worklists
 * Rate limited to prevent query abuse and expensive database operations
 */

// GET /api/search?q=term - Global search
router.get('/', searchLimiter, globalSearch);

// GET /api/worklists/global - Global worklist (unassigned cases)
router.get('/global', searchLimiter, globalWorklist);

// GET /api/worklists/category/:categoryId - Category worklist
router.get('/category/:categoryId', searchLimiter, categoryWorklist);

// GET /api/worklists/employee/me - Employee worklist
router.get('/employee/me', searchLimiter, employeeWorklist);

module.exports = router;
