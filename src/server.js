// Load environment variables FIRST (before any other imports)
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const connectDB = require('./config/database');
const config = require('./config/config');
const { runBootstrap } = require('./services/bootstrap.service');
const { maskSensitiveObject, sanitizeErrorForLog } = require('./utils/pii');
const { validateEnv } = require('./config/validateEnv');
const { logBuildMetadata } = require('./services/buildInfo.service');
require('./utils/transactionSessionEnforcer');

// Global error log sanitizer: ensure every console.error invocation masks PII (tokens, emails, phone numbers, auth headers).
// This preserves existing logging behavior/verbosity while enforcing centralized masking via maskSensitiveObject.
// The original logger is retained at console.error.original for debugging tools that need raw access.
let piiSafeErrorApplied = false;
const applyPIISafeConsoleError = () => {
  if (piiSafeErrorApplied) return;
  const originalConsoleError = console.error;
  const maskLogArg = (arg, seen) => {
    if (arg instanceof Error) {
      return sanitizeErrorForLog(arg);
    }
    if (Array.isArray(arg)) {
      return maskSensitiveObject(arg, seen);
    }
    if (arg && typeof arg === 'object') {
      return maskSensitiveObject(arg, seen);
    }
    return arg;
  };
  const piiSafeError = (...args) => {
    const seen = new WeakSet();
    const maskedArgs = args.map((arg) => maskLogArg(arg, seen));
    originalConsoleError(...maskedArgs);
  };
  piiSafeError.original = originalConsoleError;
  console.error = piiSafeError;
  piiSafeErrorApplied = true;
};

applyPIISafeConsoleError();

// Middleware
const requestLogger = require('./middleware/requestLogger');
const errorHandler = require('./middleware/errorHandler');
const notFound = require('./middleware/notFound');
const { authenticate } = require('./middleware/auth.middleware');
const degradedGuard = require('./middleware/degradedGuard');
const { firmContext } = require('./middleware/firmContext.middleware');
const { requireAdmin, requireSuperadmin } = require('./middleware/permission.middleware');
const responseContract = require('./middleware/responseContract.middleware');
const invariantGuard = require('./middleware/invariantGuard');
const domainInvariantGuard = require('./middleware/domainInvariantGuard');
const { idempotencyMiddleware } = require('./middleware/idempotency.middleware');
const transactionMiddleware = require('./middleware/transaction.middleware');
const metricsService = require('./services/metrics.service');
const { adminAuditTrail } = require('./middleware/adminAudit.middleware');
const requestLifecycle = require('./middleware/requestLifecycle.middleware');

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
const superadminRoutes = require('./routes/superadmin.routes');  // Superadmin routes
const debugRoutes = require('./routes/debug.routes');  // Debug routes (PR #43)
const inboundRoutes = require('./routes/inbound.routes');  // Inbound email routes
const publicRoutes = require('./routes/public.routes');  // Public routes (firm lookup)
const healthRoutes = require('./routes/health.routes');  // Health endpoints
const mutatingMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const forceTransactionPaths = ['/google/callback', '/my-pending'];
const writeGuardChain = (req, res, next) => {
  const shouldForceTransaction = forceTransactionPaths.some((path) => req.path && req.path.startsWith(path));
  if (!mutatingMethods.has(req.method) && !shouldForceTransaction) {
    return next();
  }
  if (shouldForceTransaction) {
    req.forceTransaction = true;
  }
  return transactionMiddleware(req, res, (err) => {
    if (err) return next(err);
    return idempotencyMiddleware(req, res, (idempotencyErr) => {
      if (idempotencyErr) return next(idempotencyErr);
      return domainInvariantGuard(req, res, next);
    });
  });
};

/**
 * Docketra - Task & Case Management System
 * Backend API Server
 */

// Log NODE_ENV for debugging
console.log(`[ENV] NODE_ENV = ${process.env.NODE_ENV || 'undefined'}`);

// Detect production mode
const isProduction = process.env.NODE_ENV === 'production';

validateEnv();
logBuildMetadata();

// Environment variable validation
const requiredEnvVars = ['MONGODB_URI', 'JWT_SECRET', 'GOOGLE_SERVICE_ACCOUNT_JSON', 'DRIVE_ROOT_FOLDER_ID'];
const missingEnvVars = requiredEnvVars.filter(key => !process.env[key]);
if (missingEnvVars.length > 0) {
  console.error(`❌ Error: Missing required environment variables: ${missingEnvVars.join(', ')}`);
  console.error('Please ensure these variables are set in your .env file or environment.');
  process.exit(1);
}

// Google Drive initialization
try {
  const driveService = require('./services/drive.service');
  driveService.initialize();
  console.log('[DRIVE] Google Drive service initialized successfully');
} catch (error) {
  console.error('❌ Error: Failed to initialize Google Drive service');
  console.error(error.message);
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
    // Note: Require here (not at top) to ensure env vars are loaded first
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

const defaultFrontendOrigin = process.env.DEFAULT_FRONTEND_ORIGIN || 'https://caseflow-1-tm8i.onrender.com';
const envFrontendUrl = process.env.FRONTEND_URL;
let parsedFrontendOrigin = null;

if (envFrontendUrl) {
  try {
    parsedFrontendOrigin = new URL(envFrontendUrl).origin;
  } catch (err) {
    console.warn(`[CORS] Ignoring invalid FRONTEND_URL: ${envFrontendUrl}`);
  }
}

const allowedOrigins = [
  parsedFrontendOrigin,
  defaultFrontendOrigin,
].filter(Boolean);
const uniqueAllowedOrigins = [...new Set(allowedOrigins)];
console.log('[CORS] Allowed origins:', uniqueAllowedOrigins);

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
  origin: function (origin, callback) {
    // Allow non-browser requests (health checks, server-to-server)
    if (!origin) {
      return callback(null, true);
    }

    if (uniqueAllowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    if (!isProduction) {
      console.warn(`[CORS] Blocked request from disallowed origin: ${origin}`);
    }
    return callback(new Error('CORS origin not allowed'), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key']
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(requestLifecycle);
app.use(requestLogger);
app.use(responseContract);
app.use(degradedGuard);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Docketra API is running',
    timestamp: new Date().toISOString(),
    environment: config.env,
  });
});
app.use('/health', healthRoutes);
const metricsAuthEnabled = !!process.env.METRICS_TOKEN;
app.get('/metrics', (req, res) => {
  if (metricsAuthEnabled) {
    const token = (req.headers.authorization || '').replace('Bearer ', '');
    if (!token || token !== process.env.METRICS_TOKEN) {
      return res.status(401).json({ error: 'unauthorized' });
    }
  }
  res.json(metricsService.getSnapshot());
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
      superadmin: '/api/superadmin',
      debug: '/api/debug',
      inbound: '/api/inbound',
    },
  });
});

// Authentication routes (public - no authentication required for login)
app.use('/api/auth', writeGuardChain, authRoutes);

// Public routes (no authentication required)
app.use('/api/public', writeGuardChain, publicRoutes);

// Category routes (public GET for active categories, admin-only for modifications)
app.use('/api/categories', writeGuardChain, categoryRoutes);

// Admin routes (firm-scoped) - enforce auth + firm context + admin role boundary
app.use('/api/admin', authenticate, firmContext, invariantGuard({ requireFirm: true, forbidSuperAdmin: true }), writeGuardChain, requireAdmin, adminAuditTrail('admin'), adminRoutes);

// Superadmin routes - platform scope only (no firm context)
app.use('/api/sa', authenticate, writeGuardChain, requireSuperadmin, adminAuditTrail('superadmin'), superadminRoutes);
app.use('/api/superadmin', authenticate, writeGuardChain, requireSuperadmin, adminAuditTrail('superadmin'), superadminRoutes);

// Debug routes (PR #43) - require authentication and admin role
app.use('/api/debug', authenticate, firmContext, invariantGuard({ requireFirm: true, forbidSuperAdmin: true }), writeGuardChain, requireAdmin, debugRoutes);

// Inbound email routes (webhook - no authentication required)
app.use('/api/inbound', writeGuardChain, inboundRoutes);

// Protected routes - require authentication
// Firm context must be attached for all tenant-scoped operations
app.use('/api/users', authenticate, firmContext, invariantGuard({ requireFirm: true, forbidSuperAdmin: true }), writeGuardChain, userRoutes);
app.use('/api/tasks', authenticate, firmContext, invariantGuard({ requireFirm: true, forbidSuperAdmin: true }), writeGuardChain, taskRoutes);
app.use('/api/cases', authenticate, firmContext, invariantGuard({ requireFirm: true, forbidSuperAdmin: true }), writeGuardChain, newCaseRoutes);
app.use('/api/search', authenticate, firmContext, invariantGuard({ requireFirm: true, forbidSuperAdmin: true }), writeGuardChain, searchRoutes);
app.use('/api/worklists', authenticate, firmContext, invariantGuard({ requireFirm: true, forbidSuperAdmin: true }), writeGuardChain, searchRoutes);
app.use('/api/client-approval', authenticate, firmContext, invariantGuard({ requireFirm: true, forbidSuperAdmin: true }), writeGuardChain, clientApprovalRoutes);
app.use('/api/clients', authenticate, firmContext, invariantGuard({ requireFirm: true, forbidSuperAdmin: true }), writeGuardChain, clientRoutes);  // Client management (PR #39)
app.use('/api/reports', authenticate, firmContext, invariantGuard({ requireFirm: true, forbidSuperAdmin: true }), writeGuardChain, reportsRoutes);  // Reports routes

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

// Handle unhandled promise rejections (mask to prevent PII leakage in logs)
process.on('unhandledRejection', (err) => {
  const sanitizedError = sanitizeErrorForLog(err);
  console.error('Unhandled Promise Rejection:', sanitizedError);
  server.close(() => process.exit(1));
});

module.exports = app;
