const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/authorize');
const CasePolicy = require('../policies/case.policy');
const AdminPolicy = require('../policies/admin.policy');
const {
  userReadLimiter,
  userWriteLimiter,
  attachmentLimiter,
} = require('../middleware/rateLimiters');
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
  viewAttachment,
  downloadAttachment,
  getClientFactSheetForCase,
  viewClientFactSheetFile,
} = require('../controllers/case.controller');

// PR #44: Import xID ownership validation middleware
const {
  validateCaseCreation,
  validateCaseAssignment,
} = require('../middleware/xidOwnership.middleware');

// Import client access control middleware
const {
  checkClientAccess,
  checkCaseClientAccess,
  applyClientAccessFilter,
} = require('../middleware/clientAccess.middleware');

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
// Apply client access filter to exclude restricted clients
router.get('/', authorize(CasePolicy.canView), userReadLimiter, applyClientAccessFilter, getCases);

// POST /api/cases - Create new case
// PR #44: Apply xID ownership validation guardrails
// Apply client access check to prevent creating cases with restricted clients
router.post('/', authorize(CasePolicy.canCreate), userWriteLimiter, checkClientAccess, validateCaseCreation, createCase);

// POST /api/cases/pull - Unified pull endpoint for single or multiple cases
// IMPORTANT: Must come BEFORE /:caseId routes to avoid matching "pull" as a caseId
// Accepts: { caseIds: ["CASE-20260109-00001"] } or { caseIds: ["CASE-...", "CASE-..."] }
// User identity obtained from req.user (auth middleware), NOT from request body
// PR: Hard Cutover to xID - Removed legacy /cases/:caseId/pull endpoint
router.post('/pull', authorize(CasePolicy.canUpdate), userWriteLimiter, pullCases);

// Case action routes (RESOLVE, PEND, FILE) - PR: Case Lifecycle
const {
  resolveCase,
  pendCase,
  fileCase,
  getMyPendingCases,
  getMyResolvedCases,
  getMyUnassignedCreatedCases,
  triggerAutoReopen,
} = require('../controllers/caseActions.controller');

// GET /api/cases/my-pending - Get my pending cases
// IMPORTANT: Must come BEFORE /:caseId routes to avoid matching "my-pending" as a caseId
router.get('/my-pending', authorize(CasePolicy.canView), userReadLimiter, applyClientAccessFilter, getMyPendingCases);

// GET /api/cases/my-resolved - Get my resolved cases
// IMPORTANT: Must come BEFORE /:caseId routes to avoid matching "my-resolved" as a caseId
router.get('/my-resolved', authorize(CasePolicy.canView), userReadLimiter, applyClientAccessFilter, getMyResolvedCases);

// GET /api/cases/my-unassigned-created - Get unassigned cases created by me
// IMPORTANT: Must come BEFORE /:caseId routes to avoid matching as a caseId
// PR: Fix Case Visibility - New endpoint for dashboard accuracy
router.get('/my-unassigned-created', authorize(CasePolicy.canView), userReadLimiter, applyClientAccessFilter, getMyUnassignedCreatedCases);

// POST /api/cases/auto-reopen-pended - Trigger auto-reopen for pended cases (Admin/System)
router.post('/auto-reopen-pended', authorize(AdminPolicy.isAdmin), triggerAutoReopen);

// Case tracking routes - PR: Comprehensive CaseHistory & Audit Trail
// IMPORTANT: Must come BEFORE /:caseId routes to avoid matching as caseId
const {
  trackCaseOpen,
  trackCaseView,
  trackCaseExit,
  getCaseHistory,
} = require('../controllers/caseTracking.controller');

// POST /api/cases/:caseId/track-open - Track case opened
router.post('/:caseId/track-open', authorize(CasePolicy.canView), userWriteLimiter, checkCaseClientAccess, trackCaseOpen);

// POST /api/cases/:caseId/track-view - Track case viewed
router.post('/:caseId/track-view', authorize(CasePolicy.canView), userWriteLimiter, checkCaseClientAccess, trackCaseView);

// POST /api/cases/:caseId/track-exit - Track case exited
router.post('/:caseId/track-exit', authorize(CasePolicy.canView), userWriteLimiter, checkCaseClientAccess, trackCaseExit);

// GET /api/cases/:caseId/history - Get case audit history
router.get('/:caseId/history', authorize(CasePolicy.canView), userReadLimiter, checkCaseClientAccess, getCaseHistory);

// GET /api/cases/:caseId - Get case by caseId with comments, attachments, and history
// Check if user can access this case's client
router.get('/:caseId', authorize(CasePolicy.canView), userReadLimiter, checkCaseClientAccess, getCaseByCaseId);

// POST /api/cases/:caseId/comments - Add comment to case
router.post('/:caseId/comments', authorize(CasePolicy.canUpdate), userWriteLimiter, checkCaseClientAccess, addComment);

// POST /api/cases/:caseId/attachments - Upload attachment to case
router.post('/:caseId/attachments', upload.single('file'), authorize(CasePolicy.canUpdate), attachmentLimiter, checkCaseClientAccess, addAttachment);

// GET /api/cases/:caseId/attachments/:attachmentId/view - View attachment inline
// Note: authenticate middleware accepts xID from query params (req.query.xID)
router.get('/:caseId/attachments/:attachmentId/view', authenticate, authorize(CasePolicy.canView), attachmentLimiter, checkCaseClientAccess, viewAttachment);

// GET /api/cases/:caseId/attachments/:attachmentId/download - Download attachment
// Note: authenticate middleware accepts xID from query params (req.query.xID)
router.get('/:caseId/attachments/:attachmentId/download', authenticate, authorize(CasePolicy.canView), attachmentLimiter, checkCaseClientAccess, downloadAttachment);

// POST /api/cases/:caseId/clone - Clone case with comments and attachments
// PR #44: Apply xID validation for assignment fields
router.post('/:caseId/clone', authorize(CasePolicy.canCreate), userWriteLimiter, checkCaseClientAccess, validateCaseAssignment, cloneCase);

// POST /api/cases/:caseId/unpend - Unpend a case
router.post('/:caseId/unpend', authorize(CasePolicy.canPerformActions), userWriteLimiter, checkCaseClientAccess, unpendCase);

// PUT /api/cases/:caseId/status - Update case status
router.put('/:caseId/status', authorize(CasePolicy.canUpdate), userWriteLimiter, checkCaseClientAccess, updateCaseStatus);

// POST /api/cases/:caseId/lock - Lock a case
router.post('/:caseId/lock', authorize(CasePolicy.canUpdate), userWriteLimiter, checkCaseClientAccess, lockCaseEndpoint);

// POST /api/cases/:caseId/unlock - Unlock a case
router.post('/:caseId/unlock', authorize(CasePolicy.canUpdate), userWriteLimiter, checkCaseClientAccess, unlockCaseEndpoint);

// POST /api/cases/:caseId/activity - Update case activity (heartbeat)
router.post('/:caseId/activity', authorize(CasePolicy.canUpdate), userWriteLimiter, checkCaseClientAccess, updateCaseActivity);

// Workflow state transition routes
const {
  submitCase,
  moveToUnderReview,
  closeCase,
  reopenCase,
} = require('../controllers/caseWorkflow.controller');

// POST /api/cases/:caseId/submit - Submit case for review
router.post('/:caseId/submit', authorize(CasePolicy.canPerformActions), userWriteLimiter, submitCase);

// POST /api/cases/:caseId/review - Move case to under review
router.post('/:caseId/review', authorize(CasePolicy.canPerformActions), userWriteLimiter, moveToUnderReview);

// POST /api/cases/:caseId/close - Close a case
router.post('/:caseId/close', authorize(CasePolicy.canPerformActions), userWriteLimiter, closeCase);

// POST /api/cases/:caseId/reopen - Reopen a case
router.post('/:caseId/reopen', authorize(CasePolicy.canPerformActions), userWriteLimiter, reopenCase);

// POST /api/cases/:caseId/resolve - Resolve a case with mandatory comment
router.post('/:caseId/resolve', authorize(CasePolicy.canPerformActions), userWriteLimiter, resolveCase);

// POST /api/cases/:caseId/pend - Pend a case with mandatory comment and pendingUntil
router.post('/:caseId/pend', authorize(CasePolicy.canPerformActions), userWriteLimiter, pendCase);

// POST /api/cases/:caseId/file - File a case with mandatory comment
router.post('/:caseId/file', authorize(CasePolicy.canPerformActions), userWriteLimiter, fileCase);

// POST /api/cases/:caseId/unassign - Move case to global worklist (Admin only)
router.post('/:caseId/unassign', authorize(CasePolicy.canAssign), userWriteLimiter, unassignCase);

// Client Fact Sheet routes (Read-Only from Case view)
// GET /api/cases/:caseId/client-fact-sheet - Get client fact sheet for a case (read-only)
router.get('/:caseId/client-fact-sheet', authorize(CasePolicy.canView), userReadLimiter, checkCaseClientAccess, getClientFactSheetForCase);

// GET /api/cases/:caseId/client-fact-sheet/files/:fileId/view - View client fact sheet file (view-only, no download)
router.get('/:caseId/client-fact-sheet/files/:fileId/view', authenticate, authorize(CasePolicy.canView), attachmentLimiter, checkCaseClientAccess, viewClientFactSheetFile);

module.exports = router;
