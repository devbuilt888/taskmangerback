const express = require('express');
const router = express.Router();
const Task = require('../models/Task');
const { requireAuth } = require('../middleware/auth');

// Apply auth middleware to all routes
router.use(requireAuth);

// Get all tasks for a specific user and board
router.get('/:boardId', async (req, res) => {
  try {
    const { boardId } = req.params;
    const userId = req.userId; // From auth middleware
    
    const tasks = await Task.find({ userId, boardId });
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a new task
router.post('/', async (req, res) => {
  try {
    const userId = req.userId; // From auth middleware
    const task = new Task({
      ...req.body,
      userId
    });
    
    const savedTask = await task.save();
    res.status(201).json(savedTask);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Update a task
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId; // From auth middleware
    
    const updatedTask = await Task.findOneAndUpdate(
      { _id: id, userId },
      { ...req.body, updatedAt: Date.now() },
      { new: true }
    );
    
    if (!updatedTask) {
      return res.status(404).json({ error: 'Task not found or unauthorized' });
    }
    
    res.json(updatedTask);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete a task
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId; // From auth middleware
    
    const deletedTask = await Task.findOneAndDelete({ _id: id, userId });
    
    if (!deletedTask) {
      return res.status(404).json({ error: 'Task not found or unauthorized' });
    }
    
    res.json({ message: 'Task deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Move a task to a different column
router.patch('/:id/move', async (req, res) => {
  try {
    const { id } = req.params;
    const { columnId } = req.body;
    const userId = req.userId; // From auth middleware
    
    if (!columnId) {
      return res.status(400).json({ error: 'Column ID is required' });
    }
    
    const updatedTask = await Task.findOneAndUpdate(
      { _id: id, userId },
      { columnId, updatedAt: Date.now() },
      { new: true }
    );
    
    if (!updatedTask) {
      return res.status(404).json({ error: 'Task not found or unauthorized' });
    }
    
    res.json(updatedTask);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router; 