const express = require('express');
const router = express.Router();
const Board = require('../models/Board');
const Task = require('../models/Task');
const mongoose = require('mongoose');
const { requireAuth } = require('../middleware/auth');

// Apply auth middleware to all routes
router.use(requireAuth);

// Get all boards for a user
router.get('/', async (req, res) => {
  try {
    const userId = req.userId; // From auth middleware
    const boards = await Board.find({ userId });
    res.json(boards);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get a specific board by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId; // From auth middleware
    
    const board = await Board.findOne({ _id: id, userId });
    
    if (!board) {
      return res.status(404).json({ error: 'Board not found or unauthorized' });
    }
    
    res.json(board);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a new board
router.post('/', async (req, res) => {
  try {
    const userId = req.userId; // From auth middleware
    const board = new Board({
      ...req.body,
      userId
    });
    
    const savedBoard = await board.save();
    res.status(201).json(savedBoard);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Update a board
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId; // From auth middleware
    
    const updatedBoard = await Board.findOneAndUpdate(
      { _id: id, userId },
      { ...req.body, updatedAt: Date.now() },
      { new: true }
    );
    
    if (!updatedBoard) {
      return res.status(404).json({ error: 'Board not found or unauthorized' });
    }
    
    res.json(updatedBoard);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete a board and all its tasks
router.delete('/:id', async (req, res) => {
  // Use a transaction to ensure both operations succeed or fail together
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { id } = req.params;
    const userId = req.userId; // From auth middleware
    
    // Delete the board
    const deletedBoard = await Board.findOneAndDelete({ _id: id, userId }).session(session);
    
    if (!deletedBoard) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ error: 'Board not found or unauthorized' });
    }
    
    // Delete all tasks associated with this board
    await Task.deleteMany({ boardId: id, userId }).session(session);
    
    await session.commitTransaction();
    session.endSession();
    
    res.json({ message: 'Board and all its tasks deleted successfully' });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ error: err.message });
  }
});

module.exports = router; 