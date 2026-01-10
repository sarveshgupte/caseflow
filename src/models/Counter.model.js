const mongoose = require('mongoose');

/**
 * Counter Model for Atomic Sequence Generation
 * 
 * Used for generating sequential, unique identifiers (e.g., xID, case IDs, client IDs)
 * Ensures atomicity through MongoDB's findOneAndUpdate with $inc
 * 
 * Schema:
 * - name: Unique identifier for the counter type (e.g., 'case', 'xID', 'clientId')
 * - firmId: Firm/Organization ID for multi-tenancy (counters are tenant-scoped)
 * - seq: Current sequence value (incremented atomically)
 * 
 * PR 2: Added firmId for tenant-scoped counters
 * PR 2: Renamed 'value' to 'seq' for consistency with requirements
 * 
 * BREAKING CHANGE: The field 'value' has been renamed to 'seq'
 * Migration: All generator services (xIDGenerator, clientIdGenerator, caseIdGenerator, 
 * caseNameGenerator) have been updated to use 'seq'. Existing counters will need to be
 * renamed in the database OR the old 'value' field will be ignored and new 'seq' fields
 * will be created (starting fresh). For production deployments with existing data, run
 * a migration script to rename 'value' to 'seq' in the counters collection.
 */

const counterSchema = new mongoose.Schema({
  // Counter name - identifier for this sequence type (e.g., 'case', 'xID')
  name: {
    type: String,
    required: true,
  },
  
  // Firm/Organization ID for multi-tenancy - REQUIRED for tenant isolation
  // Counters are scoped per firm to ensure each firm has independent sequences
  firmId: {
    type: String,
    required: true,
    index: true,
  },
  
  // Current sequence value - incremented atomically
  seq: {
    type: Number,
    required: true,
    default: 0,
  },
});

// Compound unique index ensures one counter per (name, firmId) pair
counterSchema.index({ name: 1, firmId: 1 }, { unique: true });

module.exports = mongoose.model('Counter', counterSchema);
