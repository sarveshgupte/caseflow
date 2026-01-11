/**
 * Error Handler Middleware
 * Centralized error handling for the application
 */

const { maskSensitiveObject } = require('../utils/pii');

const errorHandler = (err, req, res, next) => {
  // Always mask error objects before logging to prevent PII leakage (tokens, emails, phone numbers, auth headers).
  const sanitizedError = maskSensitiveObject({
    message: err?.message,
    stack: err?.stack,
    ...(err && typeof err === 'object' ? err : {}),
  });
  console.error('Error:', sanitizedError);
  
  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(e => e.message);
    return res.status(400).json({
      success: false,
      error: 'Validation Error',
      messages: errors,
    });
  }
  
  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0];
    return res.status(400).json({
      success: false,
      error: 'Duplicate Error',
      message: `${field} already exists`,
    });
  }
  
  // Mongoose CastError (invalid ObjectId)
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      error: 'Invalid ID',
      message: 'Invalid resource ID format',
    });
  }
  
  // Default error
  res.status(err.statusCode || 500).json({
    success: false,
    error: err.message || 'Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = errorHandler;
