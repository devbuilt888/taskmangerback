# Task Manager Frontend Integration Guide

This guide explains how to correctly integrate your frontend with the Task Manager backend API.

## 🔍 Common Issues & Solutions

### 1. `e.filter is not a function` Error
This error occurs when your frontend is expecting an array but receives an object or another non-array value.

**Solution**: 
- Always check the type of the response before using array methods
- Use defensive programming techniques to handle unexpected data formats

```javascript
// Before using any array methods, check if it's an array
const tasks = await fetchTasksForBoard(boardId);
const filteredTasks = Array.isArray(tasks) ? tasks.filter(t => t.columnId === columnId) : [];
```

### 2. Empty Board Display
If your board displays no content even when a board exists, it might be because the tasks array is empty.

**Solution**:
- Initialize your board UI to display empty columns even when no tasks exist
- Don't depend on task existence to render the board structure

```javascript
// Initialize board columns regardless of tasks
function renderBoard(board, tasks) {
  // Render board structure first
  renderBoardStructure(board);
  
  // Then add tasks if they exist
  if (Array.isArray(tasks) && tasks.length > 0) {
    renderTasksOnBoard(tasks);
  }
}
```

## 📋 Correct Data Flow

### Board & Task Relationship

1. **Fetch a specific board**
   - `GET /boards/:boardId`
   - Returns board object with columns and their taskIds

2. **Fetch all tasks for that board**
   - `GET /tasks/board/:boardId`
   - Returns array of task objects (can be empty)

3. **Render the board with tasks**
   - Use the board's structure (columns) to set up UI
   - Place tasks in appropriate columns based on their `columnId`

```javascript
async function loadBoardWithTasks(boardId) {
  // Fetch board first
  const board = await fetch(`/boards/${boardId}`).then(r => r.json());
  
  // Fetch tasks for this board
  const tasks = await fetch(`/tasks/board/${boardId}`).then(r => r.json());
  
  // Make sure tasks is an array to prevent errors
  const tasksArray = Array.isArray(tasks) ? tasks : [];
  
  // Render board structure
  renderBoardStructure(board);
  
  // Place tasks in their respective columns
  board.columns.forEach(column => {
    const columnTasks = tasksArray.filter(task => task.columnId === column.id);
    renderTasksInColumn(column.id, columnTasks);
  });
}
```

## 🔄 State Management

### Task State Management

Task state should be managed as follows:

1. **Task Position**: 
   - The `columnId` property on each task determines which column it belongs to
   - The board's `columns[].taskIds` array determines the order of tasks in each column

2. **Moving Tasks**:
   - When a task is moved to a different column:
     - Update the task's `columnId` property via `PATCH /tasks/:taskId/move`
     - Update the board's columns.taskIds arrays via `PUT /boards/:boardId`

```javascript
async function moveTaskToColumn(taskId, fromColumnId, toColumnId) {
  // Update the task's columnId
  await fetch(`/tasks/${taskId}/move`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ columnId: toColumnId })
  });
  
  // Then fetch the updated board to reflect the changes
  const board = await fetch(`/boards/${boardId}`).then(r => r.json());
  
  // Update your frontend state with the new board data
  updateBoardState(board);
}
```

## 🧪 Debugging Tips

### Use the Debugging Endpoint

The backend provides a special debugging endpoint to help diagnose integration issues:

```javascript
// Test basic connectivity
fetch('/debug/frontend-test')
  .then(r => r.json())
  .then(data => console.log('Debug info:', data));

// Test board and tasks rendering
fetch('/debug/frontend-test?testType=boardTasks')
  .then(r => r.json())
  .then(data => {
    console.log('Sample board:', data.board);
    console.log('Sample tasks:', data.tasks);
    // Try rendering these in your UI
    renderBoard(data.board, data.tasks);
  });
```

### Inspect Network Responses

Always check the actual network responses in your browser's developer tools:

1. Look at the `Content-Type` header (should be `application/json`)
2. Check the response body format (should be array for collections, object for items)
3. Verify the status code (should be 200 for success)

## 📝 Complete API Integration Example

Here's a complete example of how to integrate with the Task Manager API:

```javascript
// API client utility
const API_URL = 'https://taskmangerback-t2b1.vercel.app';

const api = {
  // Board operations
  async getBoards() {
    const response = await fetch(`${API_URL}/boards`);
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  },
  
  async getBoard(boardId) {
    const response = await fetch(`${API_URL}/boards/${boardId}`);
    return await response.json();
  },
  
  async createBoard(boardData) {
    const response = await fetch(`${API_URL}/boards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(boardData)
    });
    return await response.json();
  },
  
  async updateBoard(boardId, boardData) {
    const response = await fetch(`${API_URL}/boards/${boardId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(boardData)
    });
    return await response.json();
  },
  
  // Task operations
  async getTasksForBoard(boardId) {
    const response = await fetch(`${API_URL}/tasks/board/${boardId}`);
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  },
  
  async getTask(taskId) {
    const response = await fetch(`${API_URL}/tasks/${taskId}`);
    return await response.json();
  },
  
  async createTask(taskData) {
    const response = await fetch(`${API_URL}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(taskData)
    });
    return await response.json();
  },
  
  async updateTask(taskId, taskData) {
    const response = await fetch(`${API_URL}/tasks/${taskId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(taskData)
    });
    return await response.json();
  },
  
  async moveTask(taskId, columnId) {
    const response = await fetch(`${API_URL}/tasks/${taskId}/move`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ columnId })
    });
    return await response.json();
  }
};

// Usage example
async function initializeApp() {
  try {
    // Get all boards
    const boards = await api.getBoards();
    
    // Render board list in UI
    renderBoardList(boards);
    
    // Handle board selection
    function onBoardSelect(boardId) {
      loadBoardWithTasks(boardId);
    }
    
    // Load a board with its tasks
    async function loadBoardWithTasks(boardId) {
      try {
        // Get board and tasks in parallel for efficiency
        const [board, tasks] = await Promise.all([
          api.getBoard(boardId),
          api.getTasksForBoard(boardId)
        ]);
        
        // Render board UI
        renderBoard(board);
        
        // Render tasks in their columns
        if (Array.isArray(tasks)) {
          tasks.forEach(task => {
            addTaskToColumn(task, task.columnId);
          });
        }
      } catch (error) {
        console.error('Error loading board with tasks:', error);
        showErrorMessage('Failed to load board data');
      }
    }
    
    // Create new task
    async function createNewTask(title, description, boardId, columnId) {
      try {
        const newTask = await api.createTask({
          title,
          description,
          boardId,
          columnId,
          color: 'blue',
          priority: 'medium'
        });
        
        // Add the new task to UI
        addTaskToColumn(newTask, columnId);
      } catch (error) {
        console.error('Error creating task:', error);
        showErrorMessage('Failed to create task');
      }
    }
    
    // Handle drag and drop between columns
    async function handleTaskMove(taskId, fromColumnId, toColumnId) {
      try {
        // Update on the server
        await api.moveTask(taskId, toColumnId);
        
        // UI is already updated from the drag, no need to refresh
      } catch (error) {
        console.error('Error moving task:', error);
        showErrorMessage('Failed to move task');
        
        // Revert the UI change since the server update failed
        moveTaskInUI(taskId, toColumnId, fromColumnId);
      }
    }
  } catch (error) {
    console.error('Initialization error:', error);
    showErrorMessage('Failed to initialize application');
  }
}

// Start the application
initializeApp();
```

## 🚀 Testing Your Integration

To ensure your frontend integration works correctly:

1. First test with the debugging endpoint: `/debug/frontend-test?testType=boardTasks`
2. Ensure your UI can handle both empty arrays and populated arrays
3. Test error handling by intentionally using invalid IDs
4. Verify that drag-and-drop operations update both the UI and the server state

By following these guidelines, your Task Manager frontend should properly integrate with the backend API.

## 🔧 Task Creation

### Using the Resilient Task Creation Endpoint

To avoid "Invalid board ID format" errors when creating tasks, use the more resilient task creation endpoint:

```javascript
// Standard task creation endpoint - may fail with ID format errors
fetch('/tasks', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(taskData)
});

// Resilient task creation endpoint - handles ID format problems better
fetch('/api/create-task', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(taskData)
});
```

### Handling Board ID Format Issues

When creating tasks, make sure your boardId is properly formatted:

1. **Ensure the boardId is a valid MongoDB ObjectId**
   - Must be a 24-character hexadecimal string
   - Don't include quotes or other characters

2. **Always store the exact boardId returned from the API**
   - When you fetch a board, store `board._id` exactly as received

3. **Use a helper function to clean IDs if needed**

```javascript
function cleanObjectId(id) {
  if (!id) return null;
  // Remove any non-hex characters
  return id.toString().replace(/[^a-f0-9]/gi, '');
}

// Use when creating a task
const task = {
  title: "New Task",
  boardId: cleanObjectId(currentBoardId),
  columnId: "column-1"
};
```

### Enhanced Client API for Task Creation

Here's an updated API client that handles boardId issues when creating tasks:

```javascript
// Enhanced task creation
async function createTask(taskData) {
  // First make sure boardId is clean
  if (taskData.boardId) {
    taskData.boardId = taskData.boardId.toString().replace(/[^a-f0-9]/gi, '');
  }
  
  try {
    // Try the resilient endpoint first
    const response = await fetch(`${API_URL}/api/create-task`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(taskData)
    });
    
    if (!response.ok) {
      throw new Error(`Server returned ${response.status}`);
    }
    
    return await response.json();
  } catch (err) {
    console.error('Error creating task:', err);
    throw err;
  }
}
``` 