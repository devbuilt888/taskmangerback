const express = require('express');
const router = express.Router();
const Board = require('../models/Board');
const Task = require('../models/Task');
const mongoose = require('mongoose');
const { requireAuth } = require('../middleware/auth');

// Get all boards (shared, no authentication required)
router.get('/boards', async (req, res) => {
  try {
    console.log('GET /boards request received');
    
    // Check MongoDB connection state
    const connectionState = mongoose.connection.readyState;
    console.log('MongoDB connection state:', connectionState);
    // 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
    
    if (connectionState !== 1) {
      console.error('MongoDB not connected when trying to fetch boards');
      // Return an empty array instead of an error for better frontend handling
      console.log('Returning empty ARRAY due to database connection issue');
      return res.json([]);
    }
    
    // Try to execute the query
    console.log('Attempting to fetch boards from MongoDB');
    const boards = await Board.find();
    console.log(`Successfully fetched ${boards.length} boards`);
    
    // Always return an array, even if it's empty
    res.json(boards || []);
  } catch (err) {
    console.error('Error fetching boards:', err);
    // Return empty array in case of error for more resilient frontend
    console.log('Returning empty ARRAY due to error in boards route');
    res.json([]);
  }
});

// Get a specific board
router.get('/boards/:id', async (req, res) => {
  try {
    console.log('GET /boards/:id request received for ID:', req.params.id);
    
    // Check if id is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      console.error('Invalid board ID format:', req.params.id);
      // Return empty board object instead of error
      console.log('Returning empty board for invalid ID');
      return res.json({
        _id: req.params.id,
        title: "Board not found",
        description: "The requested board could not be found",
        isShared: true,
        columns: [
          { id: "column-1", title: "To Do", taskIds: [] },
          { id: "column-2", title: "In Progress", taskIds: [] },
          { id: "column-3", title: "Done", taskIds: [] }
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }
    
    const board = await Board.findById(req.params.id);
    if (!board) {
      console.error('Board not found with ID:', req.params.id);
      // Return empty board object instead of error
      console.log('Returning placeholder board for ID:', req.params.id);
      return res.json({
        _id: req.params.id,
        title: "Board not found",
        description: "The requested board could not be found",
        isShared: true,
        columns: [
          { id: "column-1", title: "To Do", taskIds: [] },
          { id: "column-2", title: "In Progress", taskIds: [] },
          { id: "column-3", title: "Done", taskIds: [] }
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }
    
    console.log('Board found:', board._id);
    res.json(board);
  } catch (err) {
    console.error('Error fetching board:', err);
    // Return placeholder board instead of error
    console.log('Returning placeholder board due to error');
    res.json({
      _id: req.params.id,
      title: "Error loading board",
      description: "There was an error loading this board",
      isShared: true,
      columns: [
        { id: "column-1", title: "To Do", taskIds: [] },
        { id: "column-2", title: "In Progress", taskIds: [] },
        { id: "column-3", title: "Done", taskIds: [] }
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }
});

// Create a new board
router.post('/boards', requireAuth.optional, async (req, res) => {
  try {
    console.log('POST /boards request received');
    console.log('Request body:', JSON.stringify(req.body));
    
    // Ensure the board is marked as shared
    const boardData = {
      ...req.body,
      isShared: true
    };
    
    // Initialize with default columns if not provided
    if (!boardData.columns || !boardData.columns.length) {
      console.log('No columns provided, using default columns');
      boardData.columns = [
        { id: 'column-1', title: 'To Do', taskIds: [] },
        { id: 'column-2', title: 'In Progress', taskIds: [] },
        { id: 'column-3', title: 'Done', taskIds: [] }
      ];
    } else {
      // Ensure column IDs are consistent
      boardData.columns = boardData.columns.map((column, index) => {
        // If ID is missing or invalid, generate a new one
        if (!column.id || typeof column.id !== 'string') {
          console.log(`Fixing missing/invalid column ID at index ${index}`);
          column.id = `column-${index + 1}`;
        }
        
        // Ensure title exists
        if (!column.title) {
          console.log(`Fixing missing column title at index ${index}`);
          column.title = `Column ${index + 1}`;
        }
        
        // Ensure taskIds is an array
        if (!Array.isArray(column.taskIds)) {
          console.log(`Initializing taskIds array for column at index ${index}`);
          column.taskIds = [];
        }
        
        return column;
      });
    }
    
    console.log('Creating board with columns:', JSON.stringify(boardData.columns));
    
    const board = new Board(boardData);
    await board.save();
    console.log('Board created successfully with ID:', board._id);
    
    res.status(201).json(board);
  } catch (err) {
    console.error('Error creating board:', err);
    res.status(500).json({ 
      error: 'Server error', 
      message: err.message,
      stack: process.env.NODE_ENV === 'production' ? undefined : err.stack
    });
  }
});

// Update a board
router.put('/boards/:id', requireAuth.optional, async (req, res) => {
  try {
    // Remove userId if present and ensure isShared is true
    const { userId, ...updates } = req.body;
    updates.isShared = true;
    
    const board = await Board.findByIdAndUpdate(
      req.params.id,
      { ...updates, updatedAt: Date.now() },
      { new: true, runValidators: true }
    );
    
    if (!board) {
      return res.status(404).json({ error: 'Board not found' });
    }
    
    res.json(board);
  } catch (err) {
    console.error('Error updating board:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete a board
router.delete('/boards/:id', requireAuth.optional, async (req, res) => {
  try {
    const board = await Board.findById(req.params.id);
    
    if (!board) {
      return res.status(404).json({ error: 'Board not found' });
    }
    
    // Delete all tasks for this board
    await Task.deleteMany({ boardId: req.params.id });
    
    // Delete the board
    await Board.findByIdAndDelete(req.params.id);
    
    res.json({ message: 'Board deleted successfully' });
  } catch (err) {
    console.error('Error deleting board:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router; 