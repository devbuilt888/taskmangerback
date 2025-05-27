# Task Manager Frontend Integration Guide

This guide focuses on correctly integrating your frontend with the Task Manager API based on your current API calls.

## Core API Features

### Board Management
- All boards are shared among all users
- Boards have three standard columns: "todo", "in-progress", and "completed"
- When disconnected from the database, the API returns mock data to keep the UI working

### Task Management
- Tasks are associated with a specific board and column
- Task position is managed via the `columnId` property
- Moving tasks updates both the task's `columnId` and the board's `columns.taskIds` arrays

## API Usage Best Practices

### 1. MongoDB ID Handling
```javascript
// Helper function for cleaning MongoDB IDs
function cleanMongoId(id) {
  if (!id) return null;
  // Extract 24-character hex ID if embedded in a longer string
  const hexMatch = id.toString().match(/[0-9a-f]{24}/i);
  return hexMatch ? hexMatch[0] : id.toString().replace(/[^0-9a-f]/gi, '');
}
```

### 2. Resilient Data Fetching
```javascript
// Always check for array responses and provide fallbacks
async function fetchTasksForBoard(boardId) {
  try {
    const response = await fetch(`${API_BASE_URL}/tasks/board/${cleanMongoId(boardId)}`);
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error("Error fetching tasks:", error);
    return []; // Return empty array on error
  }
}
```

### 3. Creating Tasks
```javascript
// Use the more resilient task creation endpoint
async function createTask(taskData) {
  // Make sure to clean the boardId
  const cleanedTaskData = {
    ...taskData,
    boardId: cleanMongoId(taskData.boardId)
  };
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/create-task`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Origin': window.location.origin
      },
      body: JSON.stringify(cleanedTaskData)
    });
    
    return await response.json();
  } catch (error) {
    console.error("Error creating task:", error);
    throw error;
  }
}
```

### 4. Moving Tasks Between Columns
```javascript
// Update task's column and the board data
async function moveTask(taskId, fromColumnId, toColumnId, boardId) {
  try {
    // 1. Update the task's column
    await fetch(`${API_BASE_URL}/tasks/${cleanMongoId(taskId)}/move`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ columnId: toColumnId })
    });
    
    // 2. Refresh the board data to get updated taskIds arrays
    return await fetchBoard(boardId);
  } catch (error) {
    console.error("Error moving task:", error);
    throw error;
  }
}
```

## Database Connection Handling

The backend now supports graceful handling of database disconnections by:

1. Returning mock data when the database is offline
2. Supporting all operations (create/read/update) in offline mode
3. Marking mock data with `_isMock: true` property

To detect if you're working with mock data:
```javascript
function isMockData(data) {
  return data && data._isMock === true;
}

// Example usage
const board = await fetchBoard(boardId);
if (isMockData(board)) {
  // Show offline indicator in UI
  showOfflineIndicator();
}
```

## Complete Integration Example

```javascript
// API Client
const API = {
  baseUrl: 'https://taskmangerback-t2b1.vercel.app',
  
  // Helper for consistent fetch behavior
  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const defaultHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Origin': window.location.origin
    };
    
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...defaultHeaders,
          ...options.headers
        }
      });
      
      // Handle potential JSON parsing errors
      try {
        const data = await response.json();
        return data;
      } catch (e) {
        return { error: 'Invalid JSON response' };
      }
    } catch (error) {
      console.error(`API request failed: ${endpoint}`, error);
      throw error;
    }
  },
  
  // Boards
  async getBoards() {
    const data = await this.request('/boards');
    return Array.isArray(data) ? data : [];
  },
  
  async getBoard(boardId) {
    if (!boardId) throw new Error('Board ID is required');
    return this.request(`/boards/${cleanMongoId(boardId)}`);
  },
  
  async createBoard(boardData) {
    return this.request('/boards', {
      method: 'POST',
      body: JSON.stringify(boardData)
    });
  },
  
  async updateBoard(boardId, boardData) {
    if (!boardId) throw new Error('Board ID is required');
    return this.request(`/boards/${cleanMongoId(boardId)}`, {
      method: 'PUT',
      body: JSON.stringify(boardData)
    });
  },
  
  // Tasks
  async getTasksForBoard(boardId) {
    if (!boardId) throw new Error('Board ID is required');
    const data = await this.request(`/tasks/board/${cleanMongoId(boardId)}`);
    return Array.isArray(data) ? data : [];
  },
  
  async createTask(taskData) {
    if (!taskData.boardId) throw new Error('Board ID is required');
    if (!taskData.title) throw new Error('Task title is required');
    
    // Always clean the boardId
    const payload = {
      ...taskData,
      boardId: cleanMongoId(taskData.boardId)
    };
    
    return this.request('/api/create-task', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },
  
  async moveTask(taskId, columnId) {
    if (!taskId) throw new Error('Task ID is required');
    if (!columnId) throw new Error('Column ID is required');
    
    return this.request(`/tasks/${cleanMongoId(taskId)}/move`, {
      method: 'PATCH',
      body: JSON.stringify({ columnId })
    });
  },
  
  // Connection status
  async checkConnection() {
    return this.request('/debug/frontend-test');
  }
};

// Helper functions
function cleanMongoId(id) {
  if (!id) return null;
  const str = id.toString();
  // Extract 24-character hex ID if embedded in a longer string
  const hexMatch = str.match(/[0-9a-f]{24}/i);
  return hexMatch ? hexMatch[0] : str.replace(/[^0-9a-f]/gi, '');
}

function isMockData(data) {
  return data && data._isMock === true;
}
```

## Important Notes

1. **Column IDs**: Your frontend uses "todo", "in-progress", and "completed" while some backend examples use "column-1", etc. Both formats are now supported.

2. **Error Handling**: The backend now returns mock data when the database is disconnected, so your UI should continue to function.

3. **Task Creation**: Always use the `/api/create-task` endpoint for the most reliable task creation.

4. **Mock Data**: Check for the `_isMock` property to detect when the backend is returning placeholder data during database disconnection.

This guide should help ensure smooth integration between your frontend and the Task Manager backend API. 