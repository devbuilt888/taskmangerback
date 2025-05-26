const express = require('express');
const router = express.Router();
const Task = require('../models/Task');
const Board = require('../models/Board');
const { requireAuth } = require('../middleware/auth');

// Get all tasks for a board
router.get('/tasks/:boardId', async (req, res) => {
  try {
    const tasks = await Task.find({ boardId: req.params.boardId });
    res.json(tasks);
  } catch (err) {
    console.error('Error fetching tasks:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create a new task
router.post('/tasks', requireAuth.optional, async (req, res) => {
  try {
    // Ensure the task is marked as shared
    const taskData = {
      ...req.body,
      isShared: true
    };
    
    // Remove userId if present
    if (taskData.userId) {
      delete taskData.userId;
    }
    
    const task = new Task(taskData);
    await task.save();
    
    // Update the board's column to include this task
    await Board.findByIdAndUpdate(
      task.boardId,
      { 
        $push: { 
          'columns.$[elem].taskIds': task._id 
        },
        updatedAt: Date.now()
      },
      { 
        arrayFilters: [{ 'elem.id': task.columnId }],
        new: true 
      }
    );
    
    res.status(201).json(task);
  } catch (err) {
    console.error('Error creating task:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update a task
router.put('/tasks/:id', requireAuth.optional, async (req, res) => {
  try {
    // Remove userId if present and ensure isShared is true
    const { userId, ...updates } = req.body;
    updates.isShared = true;
    
    const task = await Task.findByIdAndUpdate(
      req.params.id,
      { ...updates, updatedAt: Date.now() },
      { new: true, runValidators: true }
    );
    
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    res.json(task);
  } catch (err) {
    console.error('Error updating task:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete a task
router.delete('/tasks/:id', requireAuth.optional, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    // Remove the task from the board's column
    await Board.findByIdAndUpdate(
      task.boardId,
      { 
        $pull: { 
          'columns.$[elem].taskIds': task._id 
        },
        updatedAt: Date.now()
      },
      { 
        arrayFilters: [{ 'elem.id': task.columnId }],
        new: true 
      }
    );
    
    // Delete the task
    await task.remove();
    
    res.json({ message: 'Task deleted successfully' });
  } catch (err) {
    console.error('Error deleting task:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Move a task to a different column
router.patch('/tasks/:id/move', requireAuth.optional, async (req, res) => {
  try {
    const { columnId } = req.body;
    
    if (!columnId) {
      return res.status(400).json({ error: 'Column ID is required' });
    }
    
    const task = await Task.findById(req.params.id);
    
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    // If the task is already in this column, do nothing
    if (task.columnId === columnId) {
      return res.json(task);
    }
    
    // Get the old column ID
    const oldColumnId = task.columnId;
    
    // Remove the task from the old column
    await Board.findByIdAndUpdate(
      task.boardId,
      { 
        $pull: { 
          'columns.$[elem].taskIds': task._id 
        },
        updatedAt: Date.now()
      },
      { 
        arrayFilters: [{ 'elem.id': oldColumnId }],
        new: true 
      }
    );
    
    // Add the task to the new column
    await Board.findByIdAndUpdate(
      task.boardId,
      { 
        $push: { 
          'columns.$[elem].taskIds': task._id 
        },
        updatedAt: Date.now()
      },
      { 
        arrayFilters: [{ 'elem.id': columnId }],
        new: true 
      }
    );
    
    // Update the task's column ID
    task.columnId = columnId;
    task.updatedAt = Date.now();
    await task.save();
    
    res.json(task);
  } catch (err) {
    console.error('Error moving task:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router; 