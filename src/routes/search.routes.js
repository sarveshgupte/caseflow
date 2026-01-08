const express = require('express');
const router = express.Router();
const {
  globalSearch,
  categoryWorklist,
  employeeWorklist,
  globalWorklist,
} = require('../controllers/search.controller');

/**
 * Search and Worklist Routes
 * PART A - READ-ONLY operations for finding cases and viewing worklists
 */

// GET /api/search?q=term - Global search
router.get('/', globalSearch);

// GET /api/worklists/global - Global worklist (unassigned cases)
router.get('/global', globalWorklist);

// GET /api/worklists/category/:categoryId - Category worklist
router.get('/category/:categoryId', categoryWorklist);

// GET /api/worklists/employee/me - Employee worklist
router.get('/employee/me', employeeWorklist);

module.exports = router;
