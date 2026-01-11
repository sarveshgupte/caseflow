const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticate } = require('../middleware/auth.middleware');
const { requireAdmin, blockSuperadmin } = require('../middleware/permission.middleware');
const { authorize } = require('../middleware/authorize');
const ClientPolicy = require('../policies/client.policy');
const {
  getClients,
  getClientById,
  createClient,
  updateClient,
  toggleClientStatus,
  changeLegalName,
  updateClientFactSheet,
  uploadFactSheetFile,
  deleteFactSheetFile,
} = require('../controllers/client.controller');

/**
 * Configure multer for client fact sheet file uploads
 * Store files in uploads/client-fact-sheets directory
 */
const uploadDir = path.join(__dirname, '../../uploads/client-fact-sheets');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.random().toString(36).substring(7);
    cb(null, 'cfs-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB limit
  },
});

/**
 * Client Management Routes
 * 
 * PR #39: Direct client management for Admin users
 * Admin can create, edit (restricted fields), enable/disable clients
 * No hard deletes allowed - only soft delete via isActive/status flag
 * 
 * PR #49: Client lifecycle governance
 * - Business name changes only via dedicated endpoint with audit trail
 * - PAN/TAN/CIN are immutable
 * - Only email and contact numbers can be updated normally
 * 
 * PR: Client Fact Sheet Foundation
 * - Admin can manage client fact sheet (description, notes, files)
 * - All changes are audited
 */

// Block SuperAdmin from accessing client routes
router.use(authenticate);
router.use(blockSuperadmin);

// Public/authenticated endpoints
router.get('/', authorize(ClientPolicy.canView), getClients);
router.get('/:clientId', authorize(ClientPolicy.canView), getClientById);

// Admin-only endpoints
router.post('/', authenticate, authorize(ClientPolicy.canCreate), createClient);
router.put('/:clientId', authenticate, authorize(ClientPolicy.canUpdate), updateClient);
router.patch('/:clientId/status', authenticate, authorize(ClientPolicy.canManageStatus), toggleClientStatus);
router.post('/:clientId/change-name', authenticate, authorize(ClientPolicy.canUpdate), changeLegalName);

// Client Fact Sheet endpoints (Admin-only)
router.put('/:clientId/fact-sheet', authenticate, authorize(ClientPolicy.canUpdate), updateClientFactSheet);
router.post('/:clientId/fact-sheet/files', authenticate, authorize(ClientPolicy.canUpdate), upload.single('file'), uploadFactSheetFile);
router.delete('/:clientId/fact-sheet/files/:fileId', authenticate, authorize(ClientPolicy.canUpdate), deleteFactSheetFile);

module.exports = router;
