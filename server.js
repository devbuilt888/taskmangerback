require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const boardRoutes = require('./routes/boardRoutes');
const taskRoutes = require('./routes/taskRoutes');
const config = require('./config');
const { customCors } = require('./middleware/cors');
const { toObjectId, cleanObjectIdString } = require('./utils');

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
      'https://bbglobalsolutions.com',
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

// Add compatibility routes for backward compatibility with /api prefix
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

// Fix for /boards with empty results in API path
app.get('/api/boards', async (req, res) => {
  console.log('/api/boards route hit - redirecting to /boards');
  res.redirect('/boards');
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

// Add compatibility middleware for frontend issues with tasks - IMPORTANT: This must be before routes
app.use((req, res, next) => {
  // If the URL starts with /tasks/ but is not /tasks/board/
  if (req.path.startsWith('/tasks/') && !req.path.startsWith('/tasks/board/')) {
    const pathParts = req.path.split('/');
    if (pathParts.length >= 3) {
      const possibleTaskId = pathParts[2];
      
      // Check if this is a valid MongoDB ObjectId
      if (mongoose.Types.ObjectId.isValid(possibleTaskId)) {
        // It's probably a legitimate task ID request, continue
        next();
      } else {
        // It might be a board ID or other identifier, redirect to board tasks
        console.log('Unrecognized task path format, assuming board ID:', req.path);
        res.redirect(`/tasks/board/${possibleTaskId}`);
      }
    } else {
      next();
    }
  } else {
    next();
  }
});

// Add fallback for missing tasks - this must come before route registration
app.use((req, res, next) => {
  // This captures any remaining /tasks/board/{id} requests
  const boardTasksRegex = /^\/tasks\/board\/([^\/]+)\/?$/;
  const match = req.path.match(boardTasksRegex);
  
  if (match && req.method === 'GET') {
    const boardId = match[1];
    // Here we process the request for tasks by board ID
    console.log('Custom fallback handling tasks for board:', boardId);
    
    // We'll skip normal route handling and return an empty array 
    // to prevent 404 errors when no tasks exist
    if (req.query.fallback === 'true' || req.get('X-Handle-Empty') === 'true') {
      console.log('Returning empty array via fallback middleware');
      return res.json([]);
    }
  }
  
  next();
});

// Add detailed request logging middleware for diagnostics
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Add special middleware for individual task requests
app.use((req, res, next) => {
  // Check if this is a direct task ID request (not a board/tasks request)
  const taskPattern = /^\/tasks\/([^\/]+)\/?$/;
  const boardTasksPattern = /^\/tasks\/board\/([^\/]+)\/?$/;
  
  const taskMatch = req.path.match(taskPattern);
  const boardTasksMatch = req.path.match(boardTasksPattern);
  
  // Handle board tasks requests - should always return an array
  if (boardTasksMatch && req.method === 'GET') {
    const boardId = boardTasksMatch[1];
    console.log('Board tasks middleware for board:', boardId);
    
    // If database is not connected or client needs special handling
    if (mongoose.connection.readyState !== 1 || 
        req.query.fallback === 'true' || 
        req.get('X-Empty-On-404') === 'true') {
      console.log('Providing fallback for board tasks request - returning EMPTY ARRAY');
      
      // Return an empty ARRAY for board tasks
      return res.json([]);
    }
  }
  
  // Handle individual task requests - should return an object
  else if (taskMatch && req.method === 'GET' && !req.path.includes('/board/')) {
    const taskId = taskMatch[1];
    console.log('Individual task middleware for task:', taskId);
    
    // If database is not connected or client needs special handling
    if (mongoose.connection.readyState !== 1 || 
        req.query.fallback === 'true' || 
        req.get('X-Empty-On-404') === 'true') {
      console.log('Providing fallback for task request - returning EMPTY OBJECT');
      
      // Return an empty OBJECT for individual task
      return res.json({});
    }
  }
  
  // Continue to regular route handling
  next();
});

// Add a direct board tasks route for consistent empty array responses
app.get('/tasks/board/:boardId', (req, res, next) => {
  console.log('Direct board tasks route triggered for board:', req.params.boardId);
  
  // If the DB is connected, let the regular route handle it
  if (mongoose.connection.readyState === 1) {
    // Let normal route handling proceed
    return next();
  }
  
  // If DB is not connected or there's another issue, return empty array
  console.log('Using direct board tasks route fallback - returning EMPTY ARRAY');
  return res.json([]);
});

// Add a direct task lookup route (make sure this is before route registration)
app.get('/tasks/:taskId', (req, res, next) => {
  // Skip this route if it's a board request
  if (req.path.includes('/board/')) {
    return next();
  }
  
  console.log('Direct task lookup route triggered for:', req.params.taskId);
  
  // Always return an empty object for task not found, instead of 404
  // This makes the frontend more resilient
  if (!mongoose.Types.ObjectId.isValid(req.params.taskId)) {
    console.log('Invalid task ID format in direct route:', req.params.taskId);
    return res.json({});
  }
  
  const Task = mongoose.model('Task');
  Task.findById(req.params.taskId)
    .then(task => {
      if (!task) {
        console.log('Task not found in direct route, sending empty object');
        return res.json({});
      }
      console.log('Task found in direct route:', task._id);
      res.json(task);
    })
    .catch(err => {
      console.error('Error in direct task lookup:', err);
      res.json({});
    });
});

// Routes - we're using the routes as they are now defined with full paths
// IMPORTANT: Register routes after all middleware
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

// Add a direct boards route for consistent empty array responses
app.get('/boards', (req, res, next) => {
  console.log('Direct boards route triggered');
  
  // If the DB is connected, let the regular route handle it
  if (mongoose.connection.readyState === 1) {
    // Let normal route handling proceed
    return next();
  }
  
  // If DB is not connected or there's another issue, return empty array
  console.log('Using direct boards route fallback - returning EMPTY ARRAY');
  return res.json([]);
});

// Add a direct individual board route
app.get('/boards/:boardId', (req, res, next) => {
  console.log('Direct individual board route triggered for:', req.params.boardId);
  
  // If the DB is connected, let the regular route handle it
  if (mongoose.connection.readyState === 1) {
    // Let normal route handling proceed
    return next();
  }
  
  // If DB is not connected or there's another issue, return placeholder board
  console.log('Using direct individual board route fallback - returning placeholder board');
  return res.json({
    _id: req.params.boardId,
    title: "Board Placeholder",
    description: "This is a placeholder for a board that could not be loaded",
    isShared: true,
    columns: [
      { id: "column-1", title: "To Do", taskIds: [] },
      { id: "column-2", title: "In Progress", taskIds: [] },
      { id: "column-3", title: "Done", taskIds: [] }
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
});

// Add API compatibility for individual board
app.get('/api/boards/:boardId', (req, res) => {
  console.log('API compatibility route for individual board:', req.params.boardId);
  res.redirect(`/boards/${req.params.boardId}`);
});

// Add a debug endpoint specifically for troubleshooting the frontend integration
app.get('/debug/frontend-test', async (req, res) => {
  try {
    const response = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      dbConnected: mongoose.connection.readyState === 1,
      environmentChecks: {
        nodeEnv: process.env.NODE_ENV || 'not set',
        corsEnabled: true,
        vercelDeployment: process.env.VERCEL === '1'
      },
      test: {
        emptyArray: [],
        sampleArray: [
          { id: 1, name: 'Test 1' },
          { id: 2, name: 'Test 2' }
        ],
        emptyObject: {},
        sampleObject: { id: 1, name: 'Test Object' }
      }
    };
    
    // Check for specific query parameter to test frontend behavior
    if (req.query.testType === 'boardTasks') {
      // Return sample board with tasks for testing frontend rendering
      return res.json({
        board: {
          _id: "test-board-id",
          title: "Test Board",
          description: "This is a test board for frontend debugging",
          isShared: true,
          columns: [
            { id: "column-1", title: "To Do", taskIds: ["task-1", "task-2"] },
            { id: "column-2", title: "In Progress", taskIds: ["task-3"] },
            { id: "column-3", title: "Done", taskIds: [] }
          ],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        tasks: [
          {
            _id: "task-1",
            title: "Test Task 1",
            description: "This is test task 1",
            boardId: "test-board-id",
            columnId: "column-1",
            isShared: true,
            color: "blue",
            priority: "medium",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          },
          {
            _id: "task-2",
            title: "Test Task 2",
            description: "This is test task 2",
            boardId: "test-board-id",
            columnId: "column-1",
            isShared: true,
            color: "green",
            priority: "low",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          },
          {
            _id: "task-3",
            title: "Test Task 3",
            description: "This is test task 3",
            boardId: "test-board-id",
            columnId: "column-2",
            isShared: true,
            color: "red",
            priority: "high",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        ]
      });
    }
    
    res.json(response);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add middleware to sanitize ObjectIds in requests
app.use((req, res, next) => {
  // Only process POST and PUT requests that might contain ObjectIds
  if ((req.method === 'POST' || req.method === 'PUT') && req.body) {
    // Check if this is a task creation with a boardId
    if (req.path === '/tasks' && req.body.boardId) {
      console.log('Sanitizing boardId in task creation request');
      try {
        // Clean the boardId by removing any non-hex characters
        const originalId = req.body.boardId;
        if (typeof originalId === 'string') {
          const cleanedId = originalId.replace(/[^a-f0-9]/gi, '');
          
          // Only use the cleaned ID if it's a valid ObjectId
          if (cleanedId.length === 24 && mongoose.Types.ObjectId.isValid(cleanedId)) {
            console.log(`Sanitized boardId from '${originalId}' to '${cleanedId}'`);
            req.body.boardId = cleanedId;
          }
        }
      } catch (err) {
        console.error('Error sanitizing boardId:', err);
        // Continue with original value, the route handler will deal with it
      }
    }
  }
  next();
});

// Redirect the original task creation endpoint to the simplified version
app.post('/api/create-task', (req, res, next) => {
  console.log('Redirecting task creation to simplified endpoint');
  // Forward the request to the simplified endpoint
  req.url = '/api/simple-create-task';
  next('route');
});

// Add middleware to route POST /tasks to the simplified task creation as well
app.post('/tasks', (req, res, next) => {
  console.log('Redirecting /tasks POST to simplified task creation endpoint');
  // Forward the request to the simplified endpoint
  req.url = '/api/simple-create-task';
  next('route');
});

// Add a completely new, simplified task creation endpoint
app.post('/api/simple-create-task', async (req, res) => {
  try {
    console.log('Simple task creation endpoint called');
    console.log('Request body:', JSON.stringify(req.body));
    
    // Basic validation
    if (!req.body.title && !req.body.text) {
      return res.status(400).json({ error: 'Task title is required' });
    }
    
    if (!req.body.boardId) {
      return res.status(400).json({ error: 'Board ID is required' });
    }
    
    // Get raw MongoDB collections directly - bypassing Mongoose
    const db = mongoose.connection.db;
    const boardsCollection = db.collection('boards');
    const tasksCollection = db.collection('tasks');
    
    // Try to find the board using native MongoDB driver
    let boardId;
    try {
      // Clean the board ID (remove any non-hex characters)
      const rawBoardId = req.body.boardId.toString().replace(/[^0-9a-f]/gi, '');
      if (rawBoardId.length !== 24) {
        return res.status(400).json({ 
          error: 'Invalid board ID format',
          details: 'Board ID must be a 24-character hex string'
        });
      }
      
      // Create a proper MongoDB ObjectId
      boardId = new mongoose.Types.ObjectId(rawBoardId);
    } catch (err) {
      console.error('Error with board ID:', err);
      return res.status(400).json({ 
        error: 'Invalid board ID', 
        details: err.message
      });
    }
    
    // Check if board exists using native MongoDB driver
    const board = await boardsCollection.findOne({ _id: boardId });
    if (!board) {
      return res.status(404).json({ error: 'Board not found' });
    }
    
    // Find appropriate column ID
    let columnId = req.body.columnId || 'todo';
    
    // Map common column names to what exists on the board
    const columnMap = {
      'todo': ['todo', 'to-do', 'to_do', 'column-1'],
      'in-progress': ['in-progress', 'inprogress', 'in_progress', 'column-2'],
      'done': ['done', 'completed', 'finished', 'column-3']
    };
    
    // Find matching column
    let matchedColumn = null;
    if (board.columns && board.columns.length > 0) {
      // First try direct match
      matchedColumn = board.columns.find(col => col.id === columnId);
      
      // If no direct match, try alternatives
      if (!matchedColumn) {
        for (const [conceptId, alternativeIds] of Object.entries(columnMap)) {
          if (alternativeIds.includes(columnId)) {
            // Try to find a column with any of the alternative IDs
            for (const altId of alternativeIds) {
              const altColumn = board.columns.find(col => col.id === altId);
              if (altColumn) {
                matchedColumn = altColumn;
                break;
              }
            }
            break;
          }
        }
      }
      
      // If still no match, use first column
      if (!matchedColumn) {
        matchedColumn = board.columns[0];
      }
    }
    
    // If no columns at all, create a default column structure
    if (!matchedColumn) {
      const defaultColumns = [
        { id: 'todo', title: 'To Do', taskIds: [] },
        { id: 'in-progress', title: 'In Progress', taskIds: [] },
        { id: 'done', title: 'Done', taskIds: [] }
      ];
      
      await boardsCollection.updateOne(
        { _id: boardId },
        { $set: { columns: defaultColumns } }
      );
      
      matchedColumn = defaultColumns[0];
    }
    
    // Create new task document directly
    const now = new Date();
    const newTask = {
      _id: new mongoose.Types.ObjectId(),
      title: req.body.title || req.body.text,
      description: req.body.description || '',
      boardId: boardId,
      columnId: matchedColumn.id,
      assignedUserId: req.body.assignedUserId || null,
      color: req.body.color || 'blue',
      priority: req.body.priority || 'medium',
      isShared: true,
      createdAt: now,
      updatedAt: now
    };
    
    // Insert task using native MongoDB driver
    await tasksCollection.insertOne(newTask);
    
    // Update board's column taskIds using native MongoDB driver
    await boardsCollection.updateOne(
      { _id: boardId, "columns.id": matchedColumn.id },
      { 
        $push: { "columns.$.taskIds": newTask._id.toString() },
        $set: { updatedAt: now }
      }
    );
    
    // Convert the ObjectId to string for the response
    const responseTask = {
      ...newTask,
      _id: newTask._id.toString(),
      boardId: boardId.toString()
    };
    
    // Fetch the updated board to get all the latest data
    const updatedBoard = await boardsCollection.findOne({ _id: boardId });
    
    // Format the updated board data for the response
    const formattedBoard = updatedBoard ? {
      ...updatedBoard,
      _id: updatedBoard._id.toString(),
      // Add task info to each taskId in the board's columns
      columns: updatedBoard.columns.map(column => ({
        ...column,
        // For each taskId, add task metadata if it matches our newly created task
        taskMetadata: column.taskIds.map(taskId => {
          if (taskId === responseTask._id) {
            return {
              id: taskId,
              title: responseTask.title,
              color: responseTask.color,
              priority: responseTask.priority,
              description: responseTask.description
            };
          }
          return { id: taskId };
        })
      }))
    } : null;
    
    res.status(201).json({
      success: true,
      task: responseTask,
      board: formattedBoard,
      message: 'Task created successfully'
    });
  } catch (err) {
    console.error('Error in simple task creation:', err);
    res.status(500).json({
      error: 'Failed to create task',
      message: err.message,
      originalRequest: req.body
    });
  }
});

// Add an endpoint to get a board with all its tasks
app.get('/api/board-with-tasks/:boardId', async (req, res) => {
  try {
    console.log('Getting board with tasks for ID:', req.params.boardId);
    
    if (!req.params.boardId) {
      return res.status(400).json({ error: 'Board ID is required' });
    }
    
    // Get raw MongoDB collections directly
    const db = mongoose.connection.db;
    const boardsCollection = db.collection('boards');
    const tasksCollection = db.collection('tasks');
    
    // Try to find the board using native MongoDB driver
    let boardId;
    try {
      // Clean the board ID (remove any non-hex characters)
      const rawBoardId = req.params.boardId.toString().replace(/[^0-9a-f]/gi, '');
      if (rawBoardId.length !== 24) {
        return res.status(400).json({ 
          error: 'Invalid board ID format',
          details: 'Board ID must be a 24-character hex string'
        });
      }
      
      // Create a proper MongoDB ObjectId
      boardId = new mongoose.Types.ObjectId(rawBoardId);
    } catch (err) {
      console.error('Error with board ID:', err);
      return res.status(400).json({ 
        error: 'Invalid board ID', 
        details: err.message
      });
    }
    
    // Check if board exists using native MongoDB driver
    const board = await boardsCollection.findOne({ _id: boardId });
    if (!board) {
      return res.status(404).json({ error: 'Board not found' });
    }
    
    // Get all taskIds from all columns
    const allTaskIds = [];
    if (board.columns) {
      board.columns.forEach(column => {
        if (column.taskIds && Array.isArray(column.taskIds)) {
          allTaskIds.push(...column.taskIds);
        }
      });
    }
    
    // Convert string taskIds to ObjectIds for querying
    const taskObjectIds = allTaskIds
      .filter(id => id && id.length === 24)
      .map(id => {
        try {
          return new mongoose.Types.ObjectId(id);
        } catch (err) {
          console.error('Invalid task ID:', id);
          return null;
        }
      })
      .filter(id => id !== null);
    
    // Fetch all tasks for this board in a single query
    const tasks = taskObjectIds.length > 0 
      ? await tasksCollection.find({ _id: { $in: taskObjectIds } }).toArray()
      : [];
    
    // Create a map of taskId -> task for efficient lookup
    const taskMap = {};
    tasks.forEach(task => {
      taskMap[task._id.toString()] = {
        _id: task._id.toString(),
        title: task.title,
        description: task.description || '',
        assignedUserId: task.assignedUserId || null,
        color: task.color || 'blue',
        priority: task.priority || 'medium',
        columnId: task.columnId
      };
    });
    
    // Add task data to each column
    const enhancedColumns = board.columns.map(column => {
      const enhancedTaskIds = column.taskIds.map(taskId => {
        // If we have data for this task, include it
        return taskMap[taskId] || { id: taskId };
      });
      
      return {
        ...column,
        id: column.id,
        title: column.title,
        tasks: enhancedTaskIds
      };
    });
    
    // Create the enhanced board response
    const enhancedBoard = {
      _id: board._id.toString(),
      title: board.title,
      description: board.description || '',
      isShared: board.isShared,
      columns: enhancedColumns,
      createdAt: board.createdAt,
      updatedAt: board.updatedAt
    };
    
    res.json({
      board: enhancedBoard,
      taskCount: tasks.length
    });
    
  } catch (err) {
    console.error('Error getting board with tasks:', err);
    res.status(500).json({
      error: 'Failed to get board with tasks',
      message: err.message
    });
  }
});

// Add a direct endpoint for getting enhanced tasks for a board
app.get('/api/enhanced-tasks/:boardId', async (req, res) => {
  try {
    console.log('Getting enhanced tasks for board ID:', req.params.boardId);
    
    if (!req.params.boardId) {
      return res.status(400).json({ error: 'Board ID is required' });
    }
    
    // If database is not connected, return empty array
    if (mongoose.connection.readyState !== 1) {
      console.log('Database not connected, returning empty array');
      return res.json([]);
    }
    
    // Get raw MongoDB collections directly
    const db = mongoose.connection.db;
    const tasksCollection = db.collection('tasks');
    
    // Clean and validate the board ID
    let boardId;
    try {
      // Clean the board ID (remove any non-hex characters)
      const rawBoardId = req.params.boardId.toString().replace(/[^0-9a-f]/gi, '');
      if (rawBoardId.length !== 24) {
        return res.json([]); // Return empty array for invalid ID format
      }
      
      // Create a proper MongoDB ObjectId
      boardId = new mongoose.Types.ObjectId(rawBoardId);
    } catch (err) {
      console.error('Error with board ID:', err);
      return res.json([]); // Return empty array for any error
    }
    
    // Fetch all tasks for this board
    const tasks = await tasksCollection.find({ boardId: boardId }).toArray();
    
    // Format tasks for response
    const formattedTasks = tasks.map(task => ({
      _id: task._id.toString(),
      title: task.title,
      description: task.description || '',
      boardId: task.boardId.toString(),
      columnId: task.columnId,
      assignedUserId: task.assignedUserId || null, // Include assignment field
      color: task.color || 'blue',
      priority: task.priority || 'medium',
      isShared: task.isShared !== false, // Default to true if undefined
      createdAt: task.createdAt,
      updatedAt: task.updatedAt
    }));
    
    res.json(formattedTasks);
  } catch (err) {
    console.error('Error getting enhanced tasks:', err);
    // Return empty array on error rather than error status
    res.json([]);
  }
});

// User management endpoints for Clerk integration
// Get users from Clerk (for task assignment)
app.get('/api/users', async (req, res) => {
  try {
    console.log('GET /api/users - Fetching users from Clerk');
    
    // Import Clerk if available
    const { Clerk } = require('@clerk/clerk-sdk-node');
    
    if (!process.env.CLERK_API_KEY) {
      console.warn('CLERK_API_KEY not configured, returning empty user list');
      return res.json([]);
    }
    
    const clerk = Clerk({ apiKey: process.env.CLERK_API_KEY });
    
    // Get list of users from Clerk
    const users = await clerk.users.getUserList({
      limit: 100, // Adjust limit as needed
      offset: 0
    });
    
    // Format users for frontend consumption
    const formattedUsers = users.map(user => ({
      id: user.id,
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      fullName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username || user.id,
      emailAddress: user.emailAddresses?.[0]?.emailAddress || '',
      imageUrl: user.imageUrl || '',
      username: user.username || ''
    }));
    
    console.log(`Found ${formattedUsers.length} users from Clerk`);
    res.json(formattedUsers);
  } catch (err) {
    console.error('Error fetching users from Clerk:', err);
    // Return empty array instead of error for graceful fallback
    res.json([]);
  }
});

// Get a specific user by ID
app.get('/api/users/:userId', async (req, res) => {
  try {
    console.log(`GET /api/users/${req.params.userId} - Fetching specific user`);
    
    if (!process.env.CLERK_API_KEY) {
      console.warn('CLERK_API_KEY not configured, returning empty user object');
      return res.json({});
    }
    
    const { Clerk } = require('@clerk/clerk-sdk-node');
    const clerk = Clerk({ apiKey: process.env.CLERK_API_KEY });
    
    const user = await clerk.users.getUser(req.params.userId);
    
    if (!user) {
      return res.json({});
    }
    
    const formattedUser = {
      id: user.id,
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      fullName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username || user.id,
      emailAddress: user.emailAddresses?.[0]?.emailAddress || '',
      imageUrl: user.imageUrl || '',
      username: user.username || ''
    };
    
    console.log(`Found user: ${formattedUser.fullName}`);
    res.json(formattedUser);
  } catch (err) {
    console.error('Error fetching user from Clerk:', err);
    // Return empty object instead of error for graceful fallback
    res.json({});
  }
});

// Get tasks assigned to a specific user (public endpoint)
app.get('/api/users/:userId/tasks', async (req, res) => {
  try {
    console.log(`GET /api/users/${req.params.userId}/tasks - Fetching tasks for specific user`);
    
    const userId = req.params.userId;
    if (!userId || userId === 'undefined' || userId === 'null') {
      console.log('Invalid or missing user ID, returning empty result');
      return res.json({
        userId: userId,
        tasks: [],
        count: 0
      });
    }
    
    // Get raw MongoDB collections directly
    const db = mongoose.connection.db;
    const tasksCollection = db.collection('tasks');
    const boardsCollection = db.collection('boards');
    
    // Find all tasks assigned to this user
    const tasks = await tasksCollection.find({ assignedUserId: userId }).toArray();
    console.log(`Found ${tasks.length} tasks assigned to user ${userId}`);
    
    // Get board information for each task
    const tasksWithBoardInfo = await Promise.all(
      tasks.map(async (task) => {
        try {
          const board = await boardsCollection.findOne({ _id: task.boardId });
          
          return {
            ...task,
            _id: task._id.toString(),
            boardId: task.boardId.toString(),
            assignedUserId: task.assignedUserId || null,
            boardTitle: board?.title || 'Unknown Board',
            boardDescription: board?.description || ''
          };
        } catch (err) {
          console.error('Error fetching board for task:', task._id, err);
          return {
            ...task,
            _id: task._id.toString(),
            boardId: task.boardId.toString(),
            assignedUserId: task.assignedUserId || null,
            boardTitle: 'Unknown Board',
            boardDescription: ''
          };
        }
      })
    );
    
    res.json({
      userId,
      tasks: tasksWithBoardInfo,
      count: tasksWithBoardInfo.length
    });
  } catch (err) {
    console.error('Error fetching user tasks:', err);
    // Return empty result in case of error for more resilient frontend
    res.json({
      userId: req.params.userId,
      tasks: [],
      count: 0
    });
  }
});

// Get tasks assigned to current user (using auth middleware)
app.get('/api/my-tasks', async (req, res) => {
  try {
    console.log('GET /api/my-tasks - Fetching tasks for current user');
    
    // This endpoint expects the user to be authenticated
    // The userId should be available from the auth middleware
    const userId = req.userId || req.headers['x-user-id'];
    
    if (!userId || userId === 'anonymous') {
      console.log('No authenticated user, returning empty array');
      return res.json([]);
    }
    
    // Get raw MongoDB collections directly
    const db = mongoose.connection.db;
    const tasksCollection = db.collection('tasks');
    const boardsCollection = db.collection('boards');
    
    // Find all tasks assigned to this user
    const tasks = await tasksCollection.find({ assignedUserId: userId }).toArray();
    console.log(`Found ${tasks.length} tasks assigned to user ${userId}`);
    
    // Get board information for each task
    const tasksWithBoardInfo = await Promise.all(
      tasks.map(async (task) => {
        try {
          const board = await boardsCollection.findOne({ _id: task.boardId });
          
          return {
            ...task,
            _id: task._id.toString(),
            boardId: task.boardId.toString(),
            assignedUserId: task.assignedUserId || null,
            boardTitle: board?.title || 'Unknown Board',
            boardDescription: board?.description || ''
          };
        } catch (err) {
          console.error('Error fetching board for task:', task._id, err);
          return {
            ...task,
            _id: task._id.toString(),
            boardId: task.boardId.toString(),
            assignedUserId: task.assignedUserId || null,
            boardTitle: 'Unknown Board',
            boardDescription: ''
          };
        }
      })
    );
    
    res.json(tasksWithBoardInfo);
  } catch (err) {
    console.error('Error fetching my tasks:', err);
    // Return empty array in case of error for more resilient frontend
    res.json([]);
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

// Add improved error handling for database disconnection in board creation
app.post('/boards', (req, res, next) => {
  // Check if database is connected
  if (mongoose.connection.readyState !== 1) {
    console.error('Attempt to create board while database is disconnected');
    
    // Create a mock successful response
    return res.status(201).json({
      _id: `mock-board-${Date.now()}`,
      title: req.body.title || "New Board",
      description: req.body.description || "Created while database was disconnected",
      isShared: true,
      columns: req.body.columns || [
        { id: "column-1", title: "To Do", taskIds: [] },
        { id: "column-2", title: "In Progress", taskIds: [] },
        { id: "column-3", title: "Done", taskIds: [] }
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      _isMock: true,
      _dbDisconnected: true
    });
  }
  
  // Database is connected, proceed to regular handler
  next();
}); 

// MIDDLEWARE SECTION: Add special handling for database disconnection
// This section handles the API gracefully when MongoDB is disconnected

// 1. GET /boards - Always return an array even if DB is disconnected
app.get('/boards', (req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    console.log('GET /boards called while DB disconnected - returning mock boards');
    return res.json([
      {
        _id: "mock-board-1",
        title: "Sample Board (DB Offline)",
        description: "This is a sample board available while the database is offline",
        isShared: true,
        columns: [
          { id: "todo", title: "To Do", taskIds: [] },
          { id: "in-progress", title: "In Progress", taskIds: [] },
          { id: "completed", title: "Completed", taskIds: [] }
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        _isMock: true
      }
    ]);
  }
  next();
});

// 2. GET /boards/:boardId - Return a mock board for specific ID
app.get('/boards/:boardId', (req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    console.log(`GET /boards/${req.params.boardId} called while DB disconnected - returning mock board`);
    return res.json({
      _id: req.params.boardId,
      title: "Board (DB Offline)",
      description: "This board is being viewed while the database is offline",
      isShared: true,
      columns: [
        { id: "todo", title: "To Do", taskIds: [] },
        { id: "in-progress", title: "In Progress", taskIds: [] },
        { id: "completed", title: "Completed", taskIds: [] }
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      _isMock: true
    });
  }
  next();
});

// 3. POST /boards - Create a mock board when DB is disconnected
app.post('/boards', (req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    console.log('POST /boards called while DB disconnected - returning mock response');
    // Extract columns from request or use defaults
    const columns = req.body.columns || [
      { id: "todo", title: "To Do", taskIds: [] },
      { id: "in-progress", title: "In Progress", taskIds: [] },
      { id: "completed", title: "Completed", taskIds: [] }
    ];
    
    return res.status(201).json({
      _id: `mock-board-${Date.now()}`,
      title: req.body.title || "New Board",
      description: req.body.description || "Created while database was offline",
      isShared: true,
      columns: columns,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      _isMock: true
    });
  }
  next();
});

// 4. PUT /boards/:boardId - Update a mock board when DB is disconnected
app.put('/boards/:boardId', (req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    console.log(`PUT /boards/${req.params.boardId} called while DB disconnected - returning mock response`);
    return res.json({
      _id: req.params.boardId,
      ...req.body,
      updatedAt: new Date().toISOString(),
      _isMock: true
    });
  }
  next();
});

// 5. GET /tasks/board/:boardId - Return empty tasks array when DB is disconnected
app.get('/tasks/board/:boardId', (req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    console.log(`GET /tasks/board/${req.params.boardId} called while DB disconnected - returning empty array`);
    return res.json([]);
  }
  next();
});

// 6. POST /tasks and POST /api/create-task - Create a mock task when DB is disconnected
app.post(['/tasks', '/api/create-task'], (req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    console.log('Task creation called while DB disconnected - returning mock task');
    return res.status(201).json({
      _id: `mock-task-${Date.now()}`,
      title: req.body.title || "New Task",
      description: req.body.description || "",
      boardId: req.body.boardId,
      columnId: req.body.columnId || "todo",
      color: req.body.color || "blue",
      priority: req.body.priority || "medium",
      isShared: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      _isMock: true
    });
  }
  next();
});

// 7. PATCH /tasks/:taskId/move - Update task column when DB is disconnected
app.patch('/tasks/:taskId/move', (req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    console.log(`PATCH /tasks/${req.params.taskId}/move called while DB disconnected - returning mock response`);
    return res.json({
      _id: req.params.taskId,
      columnId: req.body.columnId,
      updatedAt: new Date().toISOString(),
      _isMock: true
    });
  }
  next();
});

// Add an endpoint to delete a board with all its tasks
app.delete('/api/board/:boardId', async (req, res) => {
  try {
    console.log('Deleting board with ID:', req.params.boardId);
    
    if (!req.params.boardId) {
      return res.status(400).json({ error: 'Board ID is required' });
    }
    
    // If database is not connected, return error
    if (mongoose.connection.readyState !== 1) {
      console.log('Database not connected, cannot delete board');
      return res.status(503).json({ 
        error: 'Database connection unavailable',
        success: false
      });
    }
    
    // Get raw MongoDB collections directly
    const db = mongoose.connection.db;
    const boardsCollection = db.collection('boards');
    const tasksCollection = db.collection('tasks');
    
    // Clean and validate the board ID
    let boardId;
    try {
      // Clean the board ID (remove any non-hex characters)
      const rawBoardId = req.params.boardId.toString().replace(/[^0-9a-f]/gi, '');
      if (rawBoardId.length !== 24) {
        return res.status(400).json({ 
          error: 'Invalid board ID format',
          success: false
        });
      }
      
      // Create a proper MongoDB ObjectId
      boardId = new mongoose.Types.ObjectId(rawBoardId);
    } catch (err) {
      console.error('Error with board ID:', err);
      return res.status(400).json({ 
        error: 'Invalid board ID',
        success: false
      });
    }
    
    // First, check if the board exists
    const board = await boardsCollection.findOne({ _id: boardId });
    if (!board) {
      return res.status(404).json({
        error: 'Board not found',
        success: false
      });
    }
    
    // Store some info about the board before deleting
    const boardInfo = {
      _id: board._id.toString(),
      title: board.title,
      taskIdsCount: 0
    };
    
    // Count how many task IDs are in this board
    if (board.columns) {
      board.columns.forEach(column => {
        if (column.taskIds && Array.isArray(column.taskIds)) {
          boardInfo.taskIdsCount += column.taskIds.length;
        }
      });
    }
    
    // Delete all tasks associated with this board
    const deleteTasksResult = await tasksCollection.deleteMany({ boardId: boardId });
    
    // Delete the board
    const deleteBoardResult = await boardsCollection.deleteOne({ _id: boardId });
    
    // Check if the board was deleted
    if (deleteBoardResult.deletedCount === 0) {
      return res.status(500).json({
        error: 'Failed to delete board',
        success: false
      });
    }
    
    res.json({
      success: true,
      message: 'Board deleted successfully',
      board: boardInfo,
      tasksDeleted: deleteTasksResult.deletedCount,
      boardDeleted: deleteBoardResult.deletedCount === 1
    });
  } catch (err) {
    console.error('Error deleting board:', err);
    res.status(500).json({
      error: 'Failed to delete board',
      message: err.message,
      success: false
    });
  }
});

// Add an endpoint to delete a specific task
app.delete('/api/task/:taskId', async (req, res) => {
  try {
    console.log('Deleting task with ID:', req.params.taskId);
    
    if (!req.params.taskId) {
      return res.status(400).json({ error: 'Task ID is required' });
    }
    
    // If database is not connected, return error
    if (mongoose.connection.readyState !== 1) {
      console.log('Database not connected, cannot delete task');
      return res.status(503).json({ 
        error: 'Database connection unavailable',
        success: false
      });
    }
    
    // Get raw MongoDB collections directly
    const db = mongoose.connection.db;
    const boardsCollection = db.collection('boards');
    const tasksCollection = db.collection('tasks');
    
    // Clean and validate the task ID
    let taskId;
    try {
      // Clean the task ID (remove any non-hex characters)
      const rawTaskId = req.params.taskId.toString().replace(/[^0-9a-f]/gi, '');
      if (rawTaskId.length !== 24) {
        return res.status(400).json({ 
          error: 'Invalid task ID format',
          success: false
        });
      }
      
      // Create a proper MongoDB ObjectId
      taskId = new mongoose.Types.ObjectId(rawTaskId);
    } catch (err) {
      console.error('Error with task ID:', err);
      return res.status(400).json({ 
        error: 'Invalid task ID',
        success: false
      });
    }
    
    // First, find the task to get its boardId and columnId
    const task = await tasksCollection.findOne({ _id: taskId });
    if (!task) {
      return res.status(404).json({
        error: 'Task not found',
        success: false
      });
    }
    
    // Store task info before deleting
    const taskInfo = {
      _id: task._id.toString(),
      title: task.title,
      boardId: task.boardId.toString(),
      columnId: task.columnId
    };
    
    // Delete the task
    const deleteTaskResult = await tasksCollection.deleteOne({ _id: taskId });
    
    // Check if the task was deleted
    if (deleteTaskResult.deletedCount === 0) {
      return res.status(500).json({
        error: 'Failed to delete task',
        success: false
      });
    }
    
    // Remove the task ID from the board's column
    const updateBoardResult = await boardsCollection.updateOne(
      { _id: task.boardId },
      { $pull: { 'columns.$[elem].taskIds': taskId.toString() } },
      { arrayFilters: [{ 'elem.id': task.columnId }] }
    );
    
    res.json({
      success: true,
      message: 'Task deleted successfully',
      task: taskInfo,
      boardUpdated: updateBoardResult.modifiedCount === 1
    });
  } catch (err) {
    console.error('Error deleting task:', err);
    res.status(500).json({
      error: 'Failed to delete task',
      message: err.message,
      success: false
    });
  }
}); 