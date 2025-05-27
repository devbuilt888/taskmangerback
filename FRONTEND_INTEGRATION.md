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

## New Enhanced Endpoints

We've added new endpoints that provide more detailed task information:

### 1. Get Board with All Task Details

This endpoint returns a board with all its tasks in a single request, reducing the need for multiple API calls:

```javascript
// Get a board with all its tasks
async function getBoardWithFullTasks(boardId) {
  const cleanId = TaskManagerUtils.cleanMongoId(boardId);
  const response = await fetch(`/api/board-with-tasks/${cleanId}`);
  const data = await response.json();
  
  return data; // Contains { board: {...}, taskCount: 5 }
}
```

The response includes the board with enhanced columns that contain full task objects rather than just IDs:

```json
{
  "board": {
    "_id": "6834deac4d556859a0d3277f",
    "title": "My Board",
    "columns": [
      {
        "id": "todo",
        "title": "To Do",
        "taskIds": ["68362dcbe85f17690e8e50c9"],
        "_id": "6834deac4d556859a0d32780",
        "tasks": [
          {
            "_id": "68362dcbe85f17690e8e50c9",
            "title": "My Task",
            "description": "Task description",
            "color": "blue",
            "priority": "medium",
            "columnId": "todo"
          }
        ]
      }
    ]
  },
  "taskCount": 1
}
```

### 2. Get Enhanced Tasks for a Board

This endpoint returns all tasks for a board with complete task details:

```javascript
// Get all tasks with full details
async function getEnhancedTasks(boardId) {
  const cleanId = TaskManagerUtils.cleanMongoId(boardId);
  const tasks = await TaskManagerUtils.getEnhancedTasksForBoard(cleanId);
  return tasks;
}
```

The response is an array of tasks with all properties:

```json
[
  {
    "_id": "68362dcbe85f17690e8e50c9",
    "title": "My Task",
    "description": "Task description",
    "boardId": "6834deac4d556859a0d3277f",
    "columnId": "todo",
    "color": "blue",
    "priority": "medium",
    "isShared": true,
    "createdAt": "2023-11-22T15:32:11.123Z",
    "updatedAt": "2023-11-22T15:32:11.123Z"
  }
]
```

### 3. Enhanced Task Creation Response

When creating a task with the `/api/simple-create-task` endpoint, the response now includes the updated board with task metadata:

```javascript
// Create a task
const result = await TaskManagerUtils.createTaskSafely({
  title: "New Task",
  boardId: boardId,
  columnId: "todo",
  color: "blue"
});

// The result includes:
// - task: the created task
// - board: the updated board with columns containing task metadata
// - success: true/false
// - message: success/error message
```

## Updated Integration Example

Here's an updated example of integrating with the Task Manager API using the new enhanced endpoints:

```javascript
// Initialize API client with utilities
const TaskAPI = {
  baseUrl: '', // Empty for same-origin requests
  
  async createTask(taskData) {
    return TaskManagerUtils.createTaskSafely(taskData, this.baseUrl);
  },
  
  async getBoardWithTasks(boardId) {
    return TaskManagerUtils.getBoardWithTasks(boardId, this.baseUrl);
  },
  
  async getEnhancedTasks(boardId) {
    return TaskManagerUtils.getEnhancedTasksForBoard(boardId, this.baseUrl);
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

// Usage example for loading a board with all its tasks
async function loadBoardWithTasks(boardId) {
  try {
    // Get the board with all its tasks in a single request
    const result = await TaskAPI.getBoardWithTasks(boardId);
    
    if (!result.board) {
      console.error('Board not found');
      return;
    }
    
    console.log(`Loaded board with ${result.taskCount} tasks`);
    
    // The board already has all tasks embedded in the columns
    renderBoard(result.board);
  } catch (error) {
    console.error('Error loading board with tasks:', error);
  }
}
```

These new endpoints make it easier to build a responsive UI by reducing the number of API calls needed and providing more complete data in a single request. 