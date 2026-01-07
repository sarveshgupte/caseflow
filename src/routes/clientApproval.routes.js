const express = require('express');
const router = express.Router();
const {
  approveNewClient,
  approveClientEdit,
  rejectClientCase,
  getClientById,
  listClients,
} = require('../controllers/clientApproval.controller');

/**
 * Client Approval Routes
 * 
 * Case-driven client management endpoints.
 * All client mutations require Admin approval through cases.
 * 
 * NO direct edit/delete endpoints - immutability enforced.
 */

// Read-only endpoints (no mutations)
router.get('/clients', listClients);
router.get('/clients/:clientId', getClientById);

// Admin approval endpoints (mutations only through case workflow)
router.post('/:caseId/approve-new', approveNewClient);
router.post('/:caseId/approve-edit', approveClientEdit);
router.post('/:caseId/reject', rejectClientCase);

module.exports = router;
