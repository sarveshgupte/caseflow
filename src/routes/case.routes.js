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
} = require('../controllers/case.controller');
const { checkCaseLock } = require('../middleware/caseLock.middleware');

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

// GET /api/cases/:caseId - Get case by caseId with comments, attachments, and history
router.get('/:caseId', getCaseByCaseId);

// POST /api/cases - Create new case
router.post('/', createCase);

// POST /api/cases/:caseId/comments - Add comment to case
router.post('/:caseId/comments', addComment);

// POST /api/cases/:caseId/attachments - Upload attachment to case
router.post('/:caseId/attachments', upload.single('file'), addAttachment);

// POST /api/cases/:caseId/clone - Clone case with comments and attachments
router.post('/:caseId/clone', cloneCase);

// POST /api/cases/:caseId/unpend - Unpend a case
router.post('/:caseId/unpend', unpendCase);

// PUT /api/cases/:caseId/status - Update case status
router.put('/:caseId/status', updateCaseStatus);

// POST /api/cases/:caseId/lock - Lock a case
router.post('/:caseId/lock', lockCaseEndpoint);

// POST /api/cases/:caseId/unlock - Unlock a case
router.post('/:caseId/unlock', unlockCaseEndpoint);

module.exports = router;
