# Frontend Integration Guide for Task Manager API

This guide provides solutions for the MongoDB ObjectId issues you're encountering with the Task Manager API.

## The Problem

You're experiencing errors like:
```
"Class constructor ObjectId cannot be invoked without 'new'"
"Task validation failed: boardId: Cast to ObjectId failed"
```

These occur because MongoDB requires proper ObjectId formatting, and there are inconsistencies in how the IDs are being processed.

## Solution 1: Use the Simplified API Endpoints

We've created a new simplified endpoint that handles ObjectId conversion more robustly:

```javascript
// Create a task using the simplified endpoint
async function createTask(taskData) {
  // Ensure we have a clean board ID
  const cleanedData = {
    ...taskData,
    boardId: taskData.boardId.toString().replace(/[^0-9a-f]/gi, '')
  };
  
  const response = await fetch('/api/simple-create-task', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(cleanedData)
  });
  
  return await response.json();
}
```

## Solution 2: Use the apiUtils.js Library

We've created a utility library to help with MongoDB ObjectId handling. Include this in your frontend:

```html
<script src="/js/apiUtils.js"></script>
```

Then use the provided utilities:

```javascript
// Example usage in your frontend code
document.getElementById('createTaskBtn').addEventListener('click', async () => {
  const boardId = document.getElementById('boardId').value;
  
  // Create task with safe ID handling
  const result = await TaskManagerUtils.createTaskSafely({
    title: 'New Task',
    description: 'Task description',
    boardId: boardId,
    columnId: 'todo',
    color: 'blue'
  });
  
  if (result.success) {
    console.log('Task created:', result.task);
  } else {
    console.error('Error:', result.error || result.message);
  }
});
```

## Complete Integration Example

Here's a complete example of integrating with the Task Manager API:

```javascript
// Initialize API client with utilities
const TaskAPI = {
  baseUrl: '', // Empty for same-origin requests
  
  async createTask(taskData) {
    return TaskManagerUtils.createTaskSafely(taskData, this.baseUrl);
  },
  
  async getTasksForBoard(boardId) {
    return TaskManagerUtils.getBoardTasksSafely(boardId, this.baseUrl);
  },
  
  async getBoard(boardId) {
    const cleanId = TaskManagerUtils.cleanMongoId(boardId);
    try {
      const response = await fetch(`${this.baseUrl}/boards/${cleanId}`);
      return await response.json();
    } catch (error) {
      console.error('Error fetching board:', error);
      return null;
    }
  },
  
  async moveTask(taskId, columnId) {
    const cleanTaskId = TaskManagerUtils.cleanMongoId(taskId);
    try {
      const response = await fetch(`${this.baseUrl}/tasks/${cleanTaskId}/move`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ columnId })
      });
      return await response.json();
    } catch (error) {
      console.error('Error moving task:', error);
      throw error;
    }
  }
};

// Usage example
async function loadBoard(boardId) {
  try {
    // Get the board data
    const board = await TaskAPI.getBoard(boardId);
    if (!board || !board._id) {
      console.error('Board not found');
      return;
    }
    
    // Get the tasks for the board
    const tasks = await TaskAPI.getTasksForBoard(board._id);
    
    // Render the board and tasks
    renderBoard(board, tasks);
  } catch (error) {
    console.error('Error loading board:', error);
  }
}

// Example task creation
async function createNewTask(boardId, taskTitle) {
  try {
    const result = await TaskAPI.createTask({
      title: taskTitle,
      boardId: boardId,
      columnId: 'todo',
      color: 'blue'
    });
    
    if (result.success) {
      console.log('Task created successfully');
      return result.task;
    } else {
      console.error('Error creating task:', result.message);
      return null;
    }
  } catch (error) {
    console.error('Exception creating task:', error);
    return null;
  }
}
```

## Testing Your Integration

1. Make sure you're using the `/api/simple-create-task` endpoint for task creation
2. Always clean MongoDB ObjectIds before sending them to the API
3. Check the browser console for any errors during API requests

If you continue to experience issues, you can add this debugging code:

```javascript
// Add this before making API calls
function debugObjectId(id) {
  console.log('Original ID:', id);
  console.log('Cleaned ID:', TaskManagerUtils.cleanMongoId(id));
  console.log('Is valid:', TaskManagerUtils.isValidMongoId(id));
  return TaskManagerUtils.cleanMongoId(id);
}
```

---

By following this guide, you should be able to resolve the ObjectId validation issues you're experiencing when creating tasks. 