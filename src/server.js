require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const connectDB = require('./config/database');
const config = require('./config/config');

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
const reportsRoutes = require('./routes/reports.routes');  // Reports routes

/**
 * Caseflow - Task & Case Management System
 * Backend API Server
 */

// Environment variable validation
const requiredEnvVars = ['MONGODB_URI', 'JWT_SECRET'];
const missingEnvVars = requiredEnvVars.filter(key => !process.env[key]);
if (missingEnvVars.length > 0) {
  console.error(`❌ Error: Missing required environment variables: ${missingEnvVars.join(', ')}`);
  console.error('Please ensure these variables are set in your .env file or environment.');
  process.exit(1);
}

// Initialize Express app
const app = express();

// Detect production mode
const isProduction = process.env.NODE_ENV === 'production';

// Connect to MongoDB
connectDB();

// Security Headers - Helmet
// Disable CSP and COEP since we're serving a React SPA
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

// CORS Configuration
const corsOptions = {
  origin: isProduction 
    ? process.env.FRONTEND_URL || false  // In production, require explicit FRONTEND_URL or block all
    : ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:5000'],  // Development origins
  credentials: true,
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
    message: 'Caseflow API is running',
    timestamp: new Date().toISOString(),
    environment: config.env,
  });
});

// API routes
app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: 'Welcome to Caseflow API',
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
      reports: '/api/reports',
    },
  });
});

// Authentication routes (public - no authentication required for login)
app.use('/api/auth', authRoutes);

// Protected routes - require authentication
app.use('/api/users', authenticate, userRoutes);
app.use('/api/tasks', authenticate, taskRoutes);
app.use('/api/cases', authenticate, newCaseRoutes);
app.use('/api/search', authenticate, searchRoutes);
app.use('/api/worklists', authenticate, searchRoutes);
app.use('/api/client-approval', authenticate, clientApprovalRoutes);
app.use('/api/reports', reportsRoutes);  // Reports routes (authentication handled in routes file)

// Serve static files in production
if (isProduction) {
  const uiBuildPath = path.join(__dirname, '..', 'ui', 'dist');
  
  // Serve static files from UI build directory
  app.use(express.static(uiBuildPath));
  
  // SPA fallback - serve index.html for all non-API routes
  // Use a regex pattern that's compatible with Express 5
  app.get(/^(?!\/api).*$/, (req, res) => {
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
║         Caseflow API Server                ║
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
