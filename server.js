require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const boardRoutes = require('./routes/boardRoutes');
const taskRoutes = require('./routes/taskRoutes');
const config = require('./config');
const { customCors } = require('./middleware/cors');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3001;

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl requests)
    if (!origin) return callback(null, true);
    
    // Check if origin is in allowed origins
    const allowedOrigins = [
      process.env.FRONTEND_URL,
      'http://localhost:3000',
      'http://localhost:5173',
      'https://task-manager-frontend.vercel.app',
      'https://bbglobalsolutions.org',
      'https://taskmangerback-t2b1.vercel.app'
    ].filter(Boolean); // Remove any undefined values
    
    // If FRONTEND_URL is not set or empty, allow all origins
    if (allowedOrigins.length === 0 || allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-token', 'Origin'],
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 204
};

// Apply CORS middleware
app.use(cors(corsOptions));

// Handle preflight requests for all routes
app.options('*', cors(corsOptions));

// Apply custom CORS middleware as a backup
app.use(customCors);

// Middleware
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  try {
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(200).json({
      status: 'degraded',
      timestamp: new Date().toISOString(),
      message: 'Health endpoint working but encountered an error'
    });
  }
});

// Database status endpoint
app.get('/db-status', (req, res) => {
  try {
    const connected = mongoose.connection.readyState === 1;
    res.status(200).json({ connected });
  } catch (error) {
    console.error('Database status check error:', error);
    res.status(200).json({ 
      connected: false,
      error: 'Could not determine database connection status'
    });
  }
});

// API health check route
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Server is running' });
});

// Simple API root endpoint
app.get('/', (req, res) => {
  res.json({ message: 'Task Manager API is running' });
});

// Routes - we're using the routes as they are now defined with full paths
app.use(boardRoutes);
app.use(taskRoutes);

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || config.mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('MongoDB connected'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    // Don't exit the process in production, just log the error
    if (process.env.NODE_ENV !== 'production') {
      console.error('Exiting due to MongoDB connection failure');
      process.exit(1);
    } else {
      console.error('Running in production mode without database connection');
    }
  });

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Server error' });
});

// Start the server in non-production environments
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

// Export for Vercel
module.exports = app; 