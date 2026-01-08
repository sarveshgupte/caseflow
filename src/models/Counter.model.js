const mongoose = require('mongoose');

/**
 * Counter Model for Atomic Sequence Generation
 * 
 * Used for generating sequential, unique identifiers (e.g., xID)
 * Ensures atomicity through MongoDB's findOneAndUpdate with $inc
 * 
 * Schema:
 * - name: Unique identifier for the counter (e.g., 'xID')
 * - value: Current counter value (incremented atomically)
 */

const counterSchema = new mongoose.Schema({
  // Counter name - unique identifier for this sequence
  name: {
    type: String,
    required: true,
    unique: true,
  },
  
  // Current counter value - incremented atomically
  value: {
    type: Number,
    required: true,
    default: 0,
  },
});

module.exports = mongoose.model('Counter', counterSchema);
