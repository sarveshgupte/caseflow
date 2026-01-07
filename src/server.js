require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/database');
const config = require('./config/config');

// Middleware
const requestLogger = require('./middleware/requestLogger');
const errorHandler = require('./middleware/errorHandler');
const notFound = require('./middleware/notFound');

// Routes
const userRoutes = require('./routes/users');
const taskRoutes = require('./routes/tasks');
const caseRoutes = require('./routes/cases');
const newCaseRoutes = require('./routes/case.routes');  // New case routes
const clientApprovalRoutes = require('./routes/clientApproval.routes');  // Client approval routes

/**
 * Caseflow - Task & Case Management System
 * Backend API Server
 */

// Initialize Express app
const app = express();

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors());
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
      clientApproval: '/api/client-approval',
    },
  });
});

app.use('/api/users', userRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/cases', newCaseRoutes);  // Use new case routes
app.use('/api/client-approval', clientApprovalRoutes);  // Client approval routes

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
