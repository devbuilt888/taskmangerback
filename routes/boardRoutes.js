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
      return res.status(500).json({ 
        error: 'Database connection issue', 
        state: connectionState 
      });
    }
    
    // Try to execute the query
    console.log('Attempting to fetch boards from MongoDB');
    const boards = await Board.find();
    console.log(`Successfully fetched ${boards.length} boards`);
    
    res.json(boards);
  } catch (err) {
    console.error('Error fetching boards:', err);
    // Return more detailed error info
    res.status(500).json({ 
      error: 'Server error', 
      message: err.message,
      stack: process.env.NODE_ENV === 'production' ? undefined : err.stack
    });
  }
});

// Get a specific board
router.get('/boards/:id', async (req, res) => {
  try {
    const board = await Board.findById(req.params.id);
    if (!board) {
      return res.status(404).json({ error: 'Board not found' });
    }
    res.json(board);
  } catch (err) {
    console.error('Error fetching board:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create a new board
router.post('/boards', requireAuth.optional, async (req, res) => {
  try {
    // Ensure the board is marked as shared
    const boardData = {
      ...req.body,
      isShared: true
    };
    
    // Initialize with default columns if not provided
    if (!boardData.columns) {
      boardData.columns = [
        { id: 'column-1', title: 'To Do', taskIds: [] },
        { id: 'column-2', title: 'In Progress', taskIds: [] },
        { id: 'column-3', title: 'Done', taskIds: [] }
      ];
    }
    
    const board = new Board(boardData);
    await board.save();
    res.status(201).json(board);
  } catch (err) {
    console.error('Error creating board:', err);
    res.status(500).json({ error: 'Server error' });
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