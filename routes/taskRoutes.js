const express = require('express');
const router = express.Router();
const Task = require('../models/Task');
const Board = require('../models/Board');
const { requireAuth } = require('../middleware/auth');
const mongoose = require('mongoose');

// Get tasks for a board
router.get('/tasks/board/:boardId', async (req, res) => {
  try {
    console.log(`GET /tasks/board/${req.params.boardId} - Fetching tasks for board`);
    
    if (!mongoose.Types.ObjectId.isValid(req.params.boardId)) {
      console.error('Invalid board ID format:', req.params.boardId);
      // Return empty array instead of error for easier frontend handling
      return res.json([]);
    }
    
    // First check if the board exists
    const boardExists = await Board.exists({ _id: mongoose.Types.ObjectId(req.params.boardId) });
    if (!boardExists) {
      console.log(`Board with ID ${req.params.boardId} not found, returning empty task array`);
      return res.json([]);
    }
    
    // Convert boardId string to ObjectId to ensure proper matching
    const boardIdObj = mongoose.Types.ObjectId(req.params.boardId);
    
    // Debug: Log what we're looking for
    console.log('Finding tasks with boardId (ObjectId):', boardIdObj);
    
    // Find tasks with the converted ObjectId
    const tasks = await Task.find({ boardId: boardIdObj });
    console.log(`Found ${tasks.length} tasks for board ${req.params.boardId}`);
    
    // Debug: If no tasks found, query to see what boardIds exist
    if (tasks.length === 0) {
      console.log('No tasks found. Checking for any tasks in database...');
      const allTasks = await Task.find({}).limit(5);
      console.log('Sample of tasks in database:', 
        allTasks.map(t => ({ id: t._id.toString(), boardId: t.boardId.toString() }))
      );
    }
    
    // Always return the tasks array, even if empty
    res.json(tasks);
  } catch (err) {
    console.error('Error fetching tasks for board:', err);
    // Return empty array in case of error for more resilient frontend
    res.json([]);
  }
});

// Add a compatibility route for accessing tasks from board
router.get('/boards/:boardId/tasks', async (req, res) => {
  try {
    console.log(`GET /boards/${req.params.boardId}/tasks - Compatibility route for board tasks`);
    
    if (!mongoose.Types.ObjectId.isValid(req.params.boardId)) {
      console.error('Invalid board ID format:', req.params.boardId);
      return res.status(400).json({ error: 'Invalid board ID format' });
    }
    
    // Redirect to the standard route
    res.redirect(`/tasks/board/${req.params.boardId}`);
  } catch (err) {
    console.error('Error in compatibility route:', err);
    // Default to empty array in case of error
    res.json([]);
  }
});

// Get a specific task by ID with error handling to return empty object for 404s
router.get('/tasks/:id', async (req, res) => {
  try {
    console.log(`GET /tasks/${req.params.id} - Fetching specific task`);
    
    // Check if this might be a board ID instead of a task ID
    // If the URL could be interpreted as a request for all tasks for a board
    if (req.query.board === 'true' || req.query.type === 'board') {
      console.log('Request appears to be for tasks by board ID, redirecting');
      return res.redirect(`/tasks/board/${req.params.id}`);
    }
    
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      console.error('Invalid task ID format:', req.params.id);
      // For single task requests, if frontend expects an object, return empty object
      // This is more consistent than returning 404 for invalid IDs
      console.log('Returning empty object for invalid task ID');
      return res.json({});
    }
    
    const task = await Task.findById(req.params.id);
    
    if (!task) {
      console.error('Task not found with ID:', req.params.id);
      
      // ALWAYS return an empty object instead of 404 for better frontend compatibility
      // Frontend can check for empty object or missing ID
      console.log('Task not found, returning empty object instead of 404');
      return res.json({});
    }
    
    console.log('Task found:', task._id);
    res.json(task);
  } catch (err) {
    console.error('Error fetching task:', err);
    // Return empty object in case of error for more resilient frontend
    console.log('Error occurred, returning empty object');
    res.json({});
  }
});

// Create a new task
router.post('/tasks', requireAuth.optional, async (req, res) => {
  try {
    console.log('POST /tasks request received');
    console.log('Request body:', JSON.stringify(req.body));
    
    // Map frontend field names to model field names
    const taskData = {
      title: req.body.title || req.body.text, // Accept either title or text
      description: req.body.description || '',
      boardId: req.body.boardId,
      columnId: req.body.columnId,
      color: req.body.color || 'blue',
      priority: req.body.priority || 'medium',
      dueDate: req.body.dueDate,
      isShared: true
    };
    
    // Validate required fields
    if (!taskData.title) {
      return res.status(400).json({ error: 'Task title/text is required' });
    }
    
    if (!taskData.boardId) {
      return res.status(400).json({ error: 'Board ID is required' });
    }
    
    if (!taskData.columnId) {
      return res.status(400).json({ error: 'Column ID is required' });
    }
    
    // Remove userId if present in the request
    if (req.body.userId) {
      console.log('Removing userId from request');
    }
    
    // Ensure boardId is a valid ObjectId and log its type
    console.log('Original boardId type:', typeof taskData.boardId);
    console.log('Original boardId value:', taskData.boardId);
    
    try {
      if (!mongoose.Types.ObjectId.isValid(taskData.boardId)) {
        console.error('Invalid boardId format:', taskData.boardId);
        return res.status(400).json({ error: 'Invalid board ID format' });
      }
      
      // Convert to ObjectId to ensure consistency
      taskData.boardId = mongoose.Types.ObjectId(taskData.boardId);
      console.log('Converted boardId type:', typeof taskData.boardId);
      console.log('Converted boardId instanceof ObjectId:', taskData.boardId instanceof mongoose.Types.ObjectId);
      console.log('Converted boardId value:', taskData.boardId.toString());
    } catch (err) {
      console.error('Error converting boardId to ObjectId:', err.message);
      return res.status(400).json({ error: 'Invalid board ID format' });
    }
    
    console.log('Checking if board exists:', taskData.boardId);
    
    // Verify the board exists
    const board = await Board.findById(taskData.boardId);
    if (!board) {
      console.error('Board not found with ID:', taskData.boardId);
      return res.status(404).json({ error: 'Board not found' });
    }
    
    console.log('Board found, columns:', JSON.stringify(board.columns.map(c => c.id)));
    console.log('Looking for column:', taskData.columnId);
    
    // Find a matching column - try exact match first, then case-insensitive
    let matchingColumn = board.columns.find(col => col.id === taskData.columnId);
    
    // If no exact match, try a more flexible approach
    if (!matchingColumn) {
      // Try lowercase comparison
      matchingColumn = board.columns.find(
        col => col.id.toLowerCase() === taskData.columnId.toLowerCase()
      );
      
      // Try matching by title (some frontends use titles as IDs)
      if (!matchingColumn) {
        matchingColumn = board.columns.find(
          col => col.title.toLowerCase() === taskData.columnId.toLowerCase()
        );
      }
      
      // If column name is a simple word like "todo", try matching with common formats
      if (!matchingColumn && /^[a-z]+$/.test(taskData.columnId)) {
        const commonFormats = [
          `column-${taskData.columnId}`,
          `col-${taskData.columnId}`,
          taskData.columnId
        ];
        
        matchingColumn = board.columns.find(col => 
          commonFormats.some(format => col.id === format || col.id.toLowerCase() === format)
        );
      }
      
      // If we found a match, use that column's actual ID
      if (matchingColumn) {
        console.log(`Found matching column "${matchingColumn.id}" for "${taskData.columnId}"`);
        taskData.columnId = matchingColumn.id;
      } else {
        // If still no match, use the first column
        if (board.columns && board.columns.length > 0) {
          console.log(`No matching column found for "${taskData.columnId}", using first column "${board.columns[0].id}"`);
          taskData.columnId = board.columns[0].id;
        } else {
          console.error('No columns found in board');
          return res.status(404).json({ error: 'No columns found in board' });
        }
      }
    }
    
    console.log('Creating new task with data:', JSON.stringify(taskData));
    
    // Create and save the task
    const task = new Task(taskData);
    const savedTask = await task.save();
    
    console.log('Task saved successfully with ID:', savedTask._id);
    
    // Update the board's column to include this task
    console.log('Updating board to include task in column:', taskData.columnId);
    await Board.findByIdAndUpdate(
      task.boardId,
      { 
        $push: { 
          'columns.$[elem].taskIds': savedTask._id.toString() 
        },
        updatedAt: Date.now()
      },
      { 
        arrayFilters: [{ 'elem.id': taskData.columnId }],
        new: true 
      }
    );
    
    console.log('Board updated successfully');
    res.status(201).json(savedTask);
  } catch (err) {
    console.error('Error creating task:', err);
    // Return more detailed error information
    res.status(500).json({ 
      error: 'Server error', 
      message: err.message,
      stack: process.env.NODE_ENV === 'production' ? undefined : err.stack 
    });
  }
});

// Update a task
router.put('/tasks/:id', requireAuth.optional, async (req, res) => {
  try {
    console.log(`PUT /tasks/${req.params.id} - Updating task`);
    
    // Remove userId if present and ensure isShared is true
    const { userId, ...updates } = req.body;
    updates.isShared = true;
    
    // If boardId is being updated, ensure it's an ObjectId
    if (updates.boardId && typeof updates.boardId === 'string') {
      if (mongoose.Types.ObjectId.isValid(updates.boardId)) {
        updates.boardId = mongoose.Types.ObjectId(updates.boardId);
        console.log('Converted boardId to ObjectId in update:', updates.boardId);
      } else {
        return res.status(400).json({ error: 'Invalid board ID format' });
      }
    }
    
    const task = await Task.findByIdAndUpdate(
      req.params.id,
      { ...updates, updatedAt: Date.now() },
      { new: true, runValidators: true }
    );
    
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    console.log('Task updated:', task._id);
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
          'columns.$[elem].taskIds': task._id.toString() 
        },
        updatedAt: Date.now()
      },
      { 
        arrayFilters: [{ 'elem.id': task.columnId }],
        new: true 
      }
    );
    
    // Delete the task - using deleteOne() instead of remove() which is deprecated
    await Task.deleteOne({ _id: task._id });
    
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
          'columns.$[elem].taskIds': task._id.toString() 
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
          'columns.$[elem].taskIds': task._id.toString() 
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