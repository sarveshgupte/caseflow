const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const {
  createCase,
  addComment,
  addAttachment,
  cloneCase,
  unpendCase,
  updateCaseStatus,
  getCaseByCaseId,
  getCases,
  lockCaseEndpoint,
  unlockCaseEndpoint,
  updateCaseActivity,
  pullCases,
  unassignCase,
} = require('../controllers/case.controller');

// PR #44: Import xID ownership validation middleware
const {
  validateCaseCreation,
  validateCaseAssignment,
} = require('../middleware/xidOwnership.middleware');

/**
 * Configure multer for file uploads
 * Store files in uploads/ directory with unique names
 */

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.random().toString(36).substring(7);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({ storage: storage });

/**
 * Case Routes
 * RESTful API endpoints for core case management
 */

// GET /api/cases - Get all cases with filtering
router.get('/', getCases);

// POST /api/cases - Create new case
// PR #44: Apply xID ownership validation guardrails
router.post('/', validateCaseCreation, createCase);

// POST /api/cases/pull - Unified pull endpoint for single or multiple cases
// IMPORTANT: Must come BEFORE /:caseId routes to avoid matching "pull" as a caseId
// Accepts: { caseIds: ["CASE-20260109-00001"] } or { caseIds: ["CASE-...", "CASE-..."] }
// User identity obtained from req.user (auth middleware), NOT from request body
// PR: Hard Cutover to xID - Removed legacy /cases/:caseId/pull endpoint
router.post('/pull', pullCases);

// GET /api/cases/:caseId - Get case by caseId with comments, attachments, and history
router.get('/:caseId', getCaseByCaseId);

// POST /api/cases/:caseId/comments - Add comment to case
router.post('/:caseId/comments', addComment);

// POST /api/cases/:caseId/attachments - Upload attachment to case
router.post('/:caseId/attachments', upload.single('file'), addAttachment);

// POST /api/cases/:caseId/clone - Clone case with comments and attachments
// PR #44: Apply xID validation for assignment fields
router.post('/:caseId/clone', validateCaseAssignment, cloneCase);

// POST /api/cases/:caseId/unpend - Unpend a case
router.post('/:caseId/unpend', unpendCase);

// PUT /api/cases/:caseId/status - Update case status
router.put('/:caseId/status', updateCaseStatus);

// POST /api/cases/:caseId/lock - Lock a case
router.post('/:caseId/lock', lockCaseEndpoint);

// POST /api/cases/:caseId/unlock - Unlock a case
router.post('/:caseId/unlock', unlockCaseEndpoint);

// POST /api/cases/:caseId/activity - Update case activity (heartbeat)
router.post('/:caseId/activity', updateCaseActivity);

// Workflow state transition routes
const {
  submitCase,
  moveToUnderReview,
  closeCase,
  reopenCase,
} = require('../controllers/caseWorkflow.controller');

// POST /api/cases/:caseId/submit - Submit case for review
router.post('/:caseId/submit', submitCase);

// POST /api/cases/:caseId/review - Move case to under review
router.post('/:caseId/review', moveToUnderReview);

// POST /api/cases/:caseId/close - Close a case
router.post('/:caseId/close', closeCase);

// POST /api/cases/:caseId/reopen - Reopen a case
router.post('/:caseId/reopen', reopenCase);

// Case action routes (RESOLVE, PEND, FILE) - PR: Case Lifecycle
const {
  resolveCase,
  pendCase,
  fileCase,
  getMyPendingCases,
  triggerAutoReopen,
} = require('../controllers/caseActions.controller');

// GET /api/cases/my-pending - Get my pending cases
// IMPORTANT: Must come BEFORE /:caseId routes to avoid matching "my-pending" as a caseId
router.get('/my-pending', getMyPendingCases);

// POST /api/cases/auto-reopen-pended - Trigger auto-reopen for pended cases (Admin/System)
router.post('/auto-reopen-pended', triggerAutoReopen);

// POST /api/cases/:caseId/resolve - Resolve a case with mandatory comment
router.post('/:caseId/resolve', resolveCase);

// POST /api/cases/:caseId/pend - Pend a case with mandatory comment and pendingUntil
router.post('/:caseId/pend', pendCase);

// POST /api/cases/:caseId/file - File a case with mandatory comment
router.post('/:caseId/file', fileCase);

// POST /api/cases/:caseId/unassign - Move case to global worklist (Admin only)
router.post('/:caseId/unassign', unassignCase);

module.exports = router;
