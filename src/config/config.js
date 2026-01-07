/**
 * Application configuration
 * Centralized configuration management
 */

module.exports = {
  port: process.env.PORT || 5000,
  env: process.env.NODE_ENV || 'development',
  appName: process.env.APP_NAME || 'Caseflow',
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/caseflow',
  
  // Pagination defaults
  pagination: {
    defaultLimit: 20,
    maxLimit: 100,
  },
  
  // Audit trail settings
  audit: {
    enableDetailedLogs: true,
  },
};
