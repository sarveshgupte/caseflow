// Load environment variables FIRST (before any other imports)
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const connectDB = require('./config/database');
const config = require('./config/config');
const { runBootstrap } = require('./services/bootstrap.service');

// Middleware
const requestLogger = require('./middleware/requestLogger');
const errorHandler = require('./middleware/errorHandler');
const notFound = require('./middleware/notFound');
const { authenticate } = require('./middleware/auth.middleware');

// Routes
const userRoutes = require('./routes/users');
const taskRoutes = require('./routes/tasks');
const caseRoutes = require('./routes/cases');
const newCaseRoutes = require('./routes/case.routes');  // New case routes
const searchRoutes = require('./routes/search.routes');  // Search and worklist routes
const authRoutes = require('./routes/auth.routes');  // Authentication routes
const clientApprovalRoutes = require('./routes/clientApproval.routes');  // Client approval routes
const clientRoutes = require('./routes/client.routes');  // Client management routes (PR #39)
const reportsRoutes = require('./routes/reports.routes');  // Reports routes
const categoryRoutes = require('./routes/category.routes');  // Category routes
const adminRoutes = require('./routes/admin.routes');  // Admin routes (PR #41)
const debugRoutes = require('./routes/debug.routes');  // Debug routes (PR #43)

/**
 * Docketra - Task & Case Management System
 * Backend API Server
 */

// Log NODE_ENV for debugging
console.log(`[ENV] NODE_ENV = ${process.env.NODE_ENV || 'undefined'}`);

// Detect production mode
const isProduction = process.env.NODE_ENV === 'production';

// Environment variable validation
const requiredEnvVars = ['MONGODB_URI', 'JWT_SECRET'];
const missingEnvVars = requiredEnvVars.filter(key => !process.env[key]);
if (missingEnvVars.length > 0) {
  console.error(`❌ Error: Missing required environment variables: ${missingEnvVars.join(', ')}`);
  console.error('Please ensure these variables are set in your .env file or environment.');
  process.exit(1);
}

// SMTP environment variable validation (production only)
if (isProduction) {
  const requiredEmailVars = ['BREVO_API_KEY'];
  const missingEmailVars = requiredEmailVars.filter(key => !process.env[key]);
  
  // Check for sender email (prefer MAIL_FROM, fallback to SMTP_FROM)
  const senderEmail = process.env.MAIL_FROM || process.env.SMTP_FROM;
  if (!senderEmail) {
    missingEmailVars.push('MAIL_FROM or SMTP_FROM');
  } else {
    // Validate MAIL_FROM format
    try {
      const { parseSender } = require('./services/email.service');
      const sender = parseSender(senderEmail);
      console.log(`[EMAIL] Using sender: ${sender.name} <${sender.email}>`);
    } catch (error) {
      console.error('❌ Error: Invalid MAIL_FROM format.');
      console.error(error.message);
      console.error('Expected format: "Name <email@domain>" or "email@domain"');
      console.error(`Current value: ${senderEmail}`);
      process.exit(1);
    }
  }
  
  if (missingEmailVars.length > 0) {
    console.error('❌ Error: Production requires Brevo API configuration for email delivery.');
    console.error('Missing email variables:', missingEmailVars.join(', '));
    console.error('Please configure these variables in your production environment:');
    missingEmailVars.forEach(varName => {
      console.error(`  - ${varName}`);
    });
    process.exit(1);
  }
  console.log('[EMAIL] Brevo API configured for production email delivery.');
} else {
  console.log('[EMAIL] Development mode – emails will be logged to console only.');
}

// Initialize Express app
const app = express();

// Connect to MongoDB and run bootstrap
connectDB()
  .then(() => runBootstrap())
  .catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });

// Security Headers - Helmet
// Disable CSP and COEP since we're serving a React SPA
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

// CORS Configuration
const corsOptions = {
  origin: true, // reflect request origin
  credentials: false,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-user-id']
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Docketra API is running',
    timestamp: new Date().toISOString(),
    environment: config.env,
  });
});

// API routes
app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: 'Welcome to Docketra API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      users: '/api/users',
      tasks: '/api/tasks',
      cases: '/api/cases',
      search: '/api/search',
      worklists: '/api/worklists',
      auth: '/api/auth',
      clientApproval: '/api/client-approval',
      clients: '/api/clients',
      reports: '/api/reports',
      categories: '/api/categories',
      admin: '/api/admin',
      debug: '/api/debug',
    },
  });
});

// Authentication routes (public - no authentication required for login)
app.use('/api/auth', authRoutes);

// Category routes (public GET for active categories, admin-only for modifications)
app.use('/api/categories', categoryRoutes);

// Admin routes (PR #41) - require authentication and admin role
app.use('/api/admin', adminRoutes);

// Debug routes (PR #43) - require authentication and admin role
app.use('/api/debug', debugRoutes);

// Protected routes - require authentication
app.use('/api/users', authenticate, userRoutes);
app.use('/api/tasks', authenticate, taskRoutes);
app.use('/api/cases', authenticate, newCaseRoutes);
app.use('/api/search', authenticate, searchRoutes);
app.use('/api/worklists', authenticate, searchRoutes);
app.use('/api/client-approval', authenticate, clientApprovalRoutes);
app.use('/api/clients', clientRoutes);  // Client management (PR #39) - authentication handled in routes
app.use('/api/reports', reportsRoutes);  // Reports routes (authentication handled in routes file)

// Root route - API status
app.get('/', (req, res) => {
  res.json({ status: 'Docketra API running' });
});

// Serve static files in production
if (isProduction) {
  const uiBuildPath = path.join(__dirname, '..', 'ui', 'dist');
  
  // Serve static files from UI build directory
  app.use(express.static(uiBuildPath));
  
  // SPA fallback - serve index.html for all non-API routes (excluding root)
  // Use a regex pattern that's compatible with Express 5
  app.get(/^(?!\/api|\/$).*$/, (req, res) => {
    res.sendFile(path.join(uiBuildPath, 'index.html'));
  });
}

// Error handling
app.use(notFound);
app.use(errorHandler);

// Start server
const PORT = config.port;
const server = app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════╗
║         Docketra API Server                ║
║                                            ║
║  Status: Running                           ║
║  Port: ${PORT}                              ║
║  Environment: ${config.env}                ║
║  URL: http://localhost:${PORT}             ║
║                                            ║
║  API Documentation: /api                   ║
║  Health Check: /health                     ║
╚════════════════════════════════════════════╝
  `);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Promise Rejection:', err);
  server.close(() => process.exit(1));
});

module.exports = app;
