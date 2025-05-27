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
app.use(express.json({
  limit: '10mb',
  verify: (req, res, buf) => {
    try {
      JSON.parse(buf);
    } catch (e) {
      res.status(400).json({ error: 'Invalid JSON' });
      throw new Error('Invalid JSON');
    }
  }
}));

// Add request body logging in development
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
      console.log(`Request body for ${req.method} ${req.url}:`, JSON.stringify(req.body));
    }
    next();
  });
}

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

// Add compatibility routes for backward compatibility
app.get('/api/tasks/:boardId', (req, res) => {
  console.log('Compatibility route hit (with /api) - redirecting to new format');
  // Redirect to the new format
  res.redirect(`/tasks/board/${req.params.boardId}`);
});

// Handle the case where frontend might call /api/tasks/board/:boardId
app.get('/api/tasks/board/:boardId', (req, res) => {
  console.log('Compatibility route hit (with /api/tasks/board) - redirecting to new format');
  // Redirect to the new format without the /api prefix
  res.redirect(`/tasks/board/${req.params.boardId}`);
});

// Create a debug endpoint to show all tasks
app.get('/debug/tasks', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database not connected' });
    }
    
    const Task = mongoose.model('Task');
    const tasks = await Task.find({}).limit(10);
    
    res.json({
      count: tasks.length,
      tasks: tasks.map(t => ({
        id: t._id.toString(),
        title: t.title,
        boardId: t.boardId.toString(),
        columnId: t.columnId
      }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add fallback middleware for database disconnection
app.use((req, res, next) => {
  // If MongoDB is not connected and the route is a data fetch route
  if (mongoose.connection.readyState !== 1 && 
      (req.path.includes('/boards') || req.path.includes('/tasks'))) {
    
    console.warn(`Database not connected, using mock data for ${req.path}`);
    
    // Return appropriate mock results based on the endpoint
    if (req.method === 'GET') {
      if (req.path === '/boards') {
        // Return a mock board
        return res.json([
          {
            _id: "mock-board-id-1",
            title: "Mock Board",
            description: "This is a mock board created because the database is unavailable",
            isShared: true,
            columns: [
              {
                id: "column-1",
                title: "To Do",
                taskIds: ["mock-task-1", "mock-task-2"]
              },
              {
                id: "column-2",
                title: "In Progress",
                taskIds: ["mock-task-3"]
              },
              {
                id: "column-3",
                title: "Done",
                taskIds: []
              }
            ],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        ]);
      } else if (req.path.startsWith('/tasks/')) {
        // Extract board ID from path
        const boardId = req.path.split('/')[2];
        if (boardId === "mock-board-id-1") {
          // Return mock tasks for the mock board
          return res.json([
            {
              _id: "mock-task-1",
              title: "Mock Task 1",
              description: "This is a mock task created because the database is unavailable",
              boardId: "mock-board-id-1",
              columnId: "column-1",
              isShared: true,
              color: "blue",
              priority: "medium",
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            },
            {
              _id: "mock-task-2",
              title: "Mock Task 2",
              description: "This is a mock task created because the database is unavailable",
              boardId: "mock-board-id-1",
              columnId: "column-1",
              isShared: true,
              color: "green",
              priority: "low",
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            },
            {
              _id: "mock-task-3",
              title: "Mock Task 3",
              description: "This is a mock task created because the database is unavailable",
              boardId: "mock-board-id-1",
              columnId: "column-2",
              isShared: true,
              color: "red",
              priority: "high",
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }
          ]);
        } else {
          return res.json([]);
        }
      }
    } else if (req.method === 'POST') {
      // Handle POST requests to create resources
      if (req.path === '/boards') {
        const mockBoard = {
          ...req.body,
          _id: `mock-board-id-${Date.now()}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        return res.status(201).json(mockBoard);
      } else if (req.path === '/tasks') {
        const mockTask = {
          ...req.body,
          _id: `mock-task-id-${Date.now()}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        return res.status(201).json(mockTask);
      }
    }
  }
  
  next();
});

// Add detailed request logging middleware for diagnostics
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Routes - we're using the routes as they are now defined with full paths
app.use(boardRoutes);
app.use(taskRoutes);

// Add a monitoring endpoint for database stats
app.get('/monitor/db-stats', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(200).json({ 
        connected: false,
        message: 'Database not connected',
        readyState: mongoose.connection.readyState
      });
    }
    
    // Get collection stats
    const stats = {};
    try {
      stats.tasks = await mongoose.connection.db.collection('tasks').stats();
      stats.boards = await mongoose.connection.db.collection('boards').stats();
    } catch (err) {
      stats.error = `Error getting collection stats: ${err.message}`;
    }
    
    // Count documents
    const counts = {};
    try {
      counts.tasks = await mongoose.connection.db.collection('tasks').countDocuments();
      counts.boards = await mongoose.connection.db.collection('boards').countDocuments();
    } catch (err) {
      counts.error = `Error counting documents: ${err.message}`;
    }
    
    res.status(200).json({
      connected: true,
      readyState: mongoose.connection.readyState,
      database: mongoose.connection.db.databaseName,
      collectionStats: stats,
      documentCounts: counts
    });
  } catch (err) {
    res.status(200).json({
      connected: false,
      error: err.message
    });
  }
});

// Add API version and collections info endpoint
app.get('/api/info', async (req, res) => {
  try {
    // Basic API info
    const apiInfo = {
      version: '1.0.0',
      name: 'Task Manager API',
      status: 'running',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      dbConnection: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
    };
    
    // If connected, get collection names
    if (mongoose.connection.readyState === 1) {
      try {
        // Get the collection names
        const collections = await mongoose.connection.db.listCollections().toArray();
        apiInfo.collections = collections.map(c => c.name);
        
        // Get some sample data to verify collections exist and have correct format
        if (collections.some(c => c.name === 'tasks')) {
          const taskSample = await mongoose.connection.db.collection('tasks')
            .find({})
            .limit(1)
            .toArray();
          
          if (taskSample.length > 0) {
            // Check if boardId is stored correctly
            apiInfo.taskSample = {
              _id: taskSample[0]._id.toString(),
              boardId: taskSample[0].boardId ? taskSample[0].boardId.toString() : 'missing',
              boardIdType: taskSample[0].boardId ? typeof taskSample[0].boardId : 'missing'
            };
          } else {
            apiInfo.taskSample = 'No tasks found';
          }
        }
        
        // Get MongoDB server info
        const serverStatus = await mongoose.connection.db.admin().serverStatus();
        apiInfo.mongoVersion = serverStatus.version;
      } catch (err) {
        apiInfo.collectionsError = err.message;
      }
    }
    
    res.status(200).json(apiInfo);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Connect to MongoDB with detailed logging
console.log('Attempting to connect to MongoDB...');
console.log('Environment:', process.env.NODE_ENV || 'development');

// Check MongoDB URI format
const mongoUri = process.env.MONGODB_URI || config.mongoURI;
if (!mongoUri) {
  console.error('CRITICAL ERROR: No MongoDB URI available');
} else {
  // Only log format, not actual credentials
  const uriPattern = /mongodb(\+srv)?:\/\/([^:]+)(:.+)?@([^/]+)\/([^?]+)(\?.+)?/;
  const match = mongoUri.match(uriPattern);
  
  if (match) {
    console.log('MongoDB URI format looks valid:');
    console.log('- Protocol:', match[1] ? 'mongodb+srv' : 'mongodb');
    console.log('- Username:', match[2]);
    console.log('- Password:', match[3] ? '[PROVIDED]' : '[NOT PROVIDED]');
    console.log('- Host:', match[4]);
    console.log('- Database:', match[5]);
    console.log('- Options:', match[6] ? '[PROVIDED]' : '[NOT PROVIDED]');
  } else {
    console.error('WARNING: MongoDB URI does not match expected format!');
  }
}

// Create a more resilient MongoDB connection with retries
let retryCount = 0;
const MAX_RETRIES = 3;

function connectWithRetry() {
  console.log(`MongoDB connection attempt ${retryCount + 1}/${MAX_RETRIES + 1}`);
  
  mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    family: 4,
    maxPoolSize: 10,
    serverApi: {
      version: '1',
      strict: true,
      deprecationErrors: true,
    }
  })
  .then(() => {
    console.log('MongoDB connected successfully');
    try {
      const { host, port, name } = mongoose.connection;
      console.log(`Connected to database: ${name} at ${host}:${port || 'default'}`);
    } catch (error) {
      console.log('Could not extract full connection details, but connection is established');
    }
    
    // Test a simple query to verify connection
    mongoose.connection.db.admin().ping()
      .then(() => console.log('MongoDB ping successful'))
      .catch(err => console.error('MongoDB ping failed:', err.message));
  })
  .catch(err => {
    console.error(`MongoDB connection error (attempt ${retryCount + 1}):`, err.message);
    
    // Try to provide more specific error guidance
    if (err.message.includes('Authentication failed')) {
      console.error('AUTHENTICATION FAILED: Check your username and password in the MongoDB URI');
    } else if (err.message.includes('getaddrinfo ENOTFOUND')) {
      console.error('HOST NOT FOUND: Check the cluster address in your MongoDB URI');
    } else if (err.message.includes('connection timed out')) {
      console.error('CONNECTION TIMEOUT: Your MongoDB Atlas IP access list might need to be updated');
    }
    
    retryCount++;
    if (retryCount < MAX_RETRIES) {
      // Exponential backoff for retries
      const retryDelay = Math.pow(2, retryCount) * 1000;
      console.log(`Retrying in ${retryDelay}ms...`);
      setTimeout(connectWithRetry, retryDelay);
    } else {
      console.error('Max MongoDB connection retries reached. Operating in offline mode.');
      if (process.env.NODE_ENV !== 'production') {
        console.error('In development mode, exiting application');
        process.exit(1);
      }
    }
  });
}

// Start connection process with a small delay to allow environment to initialize
setTimeout(connectWithRetry, 1000);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error handling request:', err.stack);
  
  // Handle Mongoose validation errors
  if (err.name === 'ValidationError') {
    const validationErrors = {};
    
    // Extract validation error messages
    for (const field in err.errors) {
      validationErrors[field] = err.errors[field].message;
    }
    
    return res.status(400).json({
      error: 'Validation Error',
      validationErrors
    });
  }
  
  // Handle Mongoose cast errors (invalid ObjectId, etc.)
  if (err.name === 'CastError') {
    return res.status(400).json({
      error: 'Invalid Data Format',
      message: `Invalid ${err.path}: ${err.value}`,
      details: err.message
    });
  }
  
  // Generic error response
  res.status(500).json({ 
    error: 'Server error',
    message: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : err.message
  });
});

// Start the server in non-production environments
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

// Export for Vercel
module.exports = app; 