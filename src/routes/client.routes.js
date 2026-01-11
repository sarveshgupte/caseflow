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
  userReadLimiter,
  userWriteLimiter,
  attachmentLimiter,
} = require('../middleware/rateLimiters');
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
  uploadClientCFSFile,
  listClientCFSFiles,
  deleteClientCFSFile,
  downloadClientCFSFile,
} = require('../controllers/client.controller');

/**
 * Configure multer for client fact sheet and CFS file uploads
 * Uses memory storage for compatibility with ephemeral filesystems (e.g., Render)
 * Files are streamed directly to Google Drive without disk I/O
 */
const upload = multer({ 
  storage: multer.memoryStorage(),
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
router.put('/:clientId/fact-sheet', authenticate, requireAdmin, authorize(ClientPolicy.canUpdate), updateClientFactSheet);
router.post('/:clientId/fact-sheet/files', authenticate, requireAdmin, authorize(ClientPolicy.canUpdate), upload.single('file'), uploadFactSheetFile);
router.delete('/:clientId/fact-sheet/files/:fileId', authenticate, requireAdmin, authorize(ClientPolicy.canUpdate), deleteFactSheetFile);

// Client CFS endpoints
// Admin-only: Upload and delete
router.post('/:clientId/cfs/files', authenticate, requireAdmin, authorize(ClientPolicy.canUpdate), attachmentLimiter, upload.single('file'), uploadClientCFSFile);
router.delete('/:clientId/cfs/files/:attachmentId', authenticate, requireAdmin, authorize(ClientPolicy.canUpdate), userWriteLimiter, deleteClientCFSFile);
// All authenticated users: List and download (read-only)
router.get('/:clientId/cfs/files', authenticate, authorize(ClientPolicy.canView), userReadLimiter, listClientCFSFiles);
router.get('/:clientId/cfs/files/:attachmentId/download', authenticate, authorize(ClientPolicy.canView), attachmentLimiter, downloadClientCFSFile);

module.exports = router;
