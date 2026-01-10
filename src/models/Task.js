const mongoose = require('mongoose');

/**
 * Task Model
 * Represents individual tasks within the system
 * Can be standalone or part of a case
 * Includes comprehensive audit trail
 */

const taskSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Task title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters'],
  },
  description: {
    type: String,
    trim: true,
    maxlength: [2000, 'Description cannot exceed 2000 characters'],
  },
  
  // Firm/Organization ID for multi-tenancy
  firmId: {
    type: String,
    required: [true, 'Firm ID is required'],
    default: 'FIRM001',
    index: true,
  },
  
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'review', 'completed', 'blocked', 'cancelled'],
    default: 'pending',
    required: true,
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium',
    required: true,
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  case: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Case',
  },
  dueDate: {
    type: Date,
  },
  completedAt: {
    type: Date,
  },
  estimatedHours: {
    type: Number,
    min: [0, 'Estimated hours cannot be negative'],
  },
  actualHours: {
    type: Number,
    min: [0, 'Actual hours cannot be negative'],
  },
  tags: [{
    type: String,
    trim: true,
  }],
  // Audit trail fields
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  statusHistory: [{
    status: {
      type: String,
      required: true,
    },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    changedAt: {
      type: Date,
      default: Date.now,
    },
    comment: String,
  }],
}, {
  timestamps: true,
});

// Indexes for performance
taskSchema.index({ status: 1, priority: -1 });
taskSchema.index({ assignedTo: 1, status: 1 });
taskSchema.index({ case: 1 });
taskSchema.index({ dueDate: 1 });
taskSchema.index({ firmId: 1 }); // Multi-tenancy queries
taskSchema.index({ firmId: 1, status: 1 }); // Firm-scoped status queries

// Pre-save middleware to track status changes
taskSchema.pre('save', async function() {
  if (this.isModified('status') && !this.isNew) {
    // Only add to history if this is an update, not a new document
    this.statusHistory.push({
      status: this.status,
      changedBy: this.updatedBy || this.createdBy,
      changedAt: new Date(),
    });
  }
  
  // Set completedAt when task is completed
  if (this.status === 'completed' && !this.completedAt) {
    this.completedAt = new Date();
  }
});

module.exports = mongoose.model('Task', taskSchema);
