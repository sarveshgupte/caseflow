/**
 * Application configuration
 * Centralized configuration management
 */

const config = {
  port: process.env.PORT || 5000,
  env: process.env.NODE_ENV || 'development',
  appName: process.env.APP_NAME || 'Docketra',
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

/**
 * Helper function to check if running in production environment
 * Used by guardrails to determine when to log warnings
 */
const isProduction = () => {
  return config.env === 'production';
};

module.exports = {
  ...config,
  isProduction,
};
