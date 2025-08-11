# Backend Task Assignment Implementation

## 🎯 Overview

This document outlines the backend implementation for task assignment features using Clerk user management. The implementation supports assigning tasks to specific users and querying tasks by assignee.

## 📊 Database Schema Changes

### Task Model Updates

**File: `models/Task.js`**

Added the `assignedUserId` field to the Task schema:

```javascript
assignedUserId: {
  type: String,
  default: null,
  trim: true
}
```

**Key Features:**
- Stores Clerk user IDs as strings
- Defaults to `null` for unassigned tasks
- Automatically trims whitespace
- Compatible with existing tasks (no migration required)

## 🔗 API Endpoints

### 1. User Management Endpoints

#### Get All Users
```
GET /api/users
```
- Fetches all users from Clerk
- Returns formatted user data for frontend consumption
- Gracefully handles missing `CLERK_API_KEY`

**Response Format:**
```json
[
  {
    "id": "user_123",
    "firstName": "John",
    "lastName": "Doe", 
    "fullName": "John Doe",
    "emailAddress": "john@example.com",
    "imageUrl": "https://...",
    "username": "johndoe"
  }
]
```

#### Get Specific User
```
GET /api/users/:userId
```
- Fetches a single user by Clerk ID
- Returns empty object if user not found

#### Get My Assigned Tasks
```
GET /api/my-tasks
```
- Requires authentication
- Returns tasks assigned to the current user
- Includes board information for each task

### 2. Task Management Endpoints (Updated)

#### Create Task with Assignment
```
POST /api/simple-create-task
POST /api/tasks
```
**New Field Support:**
- `assignedUserId`: Clerk user ID to assign the task to

**Example Request Body:**
```json
{
  "title": "Review PR",
  "description": "Review the new feature PR",
  "boardId": "board_123",
  "columnId": "todo",
  "assignedUserId": "user_456",
  "priority": "high",
  "color": "red"
}
```

#### Update Task Assignment
```
PUT /api/tasks/:id
```
**Assignment Updates:**
- Set `assignedUserId` to assign/reassign
- Set `assignedUserId` to `null` or empty string to unassign

#### Get Tasks by User
```
GET /tasks/user/:userId
```
- Returns all tasks assigned to a specific user
- Includes board information via population
- Returns empty array for invalid user IDs

## 🔧 Implementation Details

### 1. Task Creation Flow

**File: `server.js` (simple-create-task endpoint)**
```javascript
const newTask = {
  _id: new mongoose.Types.ObjectId(),
  title: req.body.title || req.body.text,
  description: req.body.description || '',
  boardId: boardId,
  columnId: matchedColumn.id,
  assignedUserId: req.body.assignedUserId || null, // ✨ New field
  color: req.body.color || 'blue',
  priority: req.body.priority || 'medium',
  isShared: true,
  createdAt: now,
  updatedAt: now
};
```

**File: `routes/taskRoutes.js` (standard task creation)**
```javascript
const taskData = {
  title: req.body.title || req.body.text,
  description: req.body.description || '',
  boardId: req.body.boardId,
  columnId: req.body.columnId,
  assignedUserId: req.body.assignedUserId || null, // ✨ New field
  color: req.body.color || 'blue',
  priority: req.body.priority || 'medium',
  dueDate: req.body.dueDate,
  isShared: true
};
```

### 2. Task Assignment Updates

**File: `routes/taskRoutes.js`**
```javascript
// Handle assignment updates
if (updates.assignedUserId !== undefined) {
  // Allow null/empty string to unassign
  updates.assignedUserId = updates.assignedUserId || null;
}
```

### 3. User Query Implementation

**File: `routes/taskRoutes.js`**
```javascript
// Get tasks assigned to a specific user
router.get('/tasks/user/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    if (!userId || userId === 'undefined' || userId === 'null') {
      return res.json([]);
    }
    
    // Find all tasks assigned to this user with board info
    const tasks = await Task.find({ assignedUserId: userId })
                            .populate('boardId', 'title description');
    
    res.json(tasks);
  } catch (err) {
    console.error('Error fetching tasks for user:', err);
    res.json([]);
  }
});
```

### 4. Clerk Integration

**File: `server.js`**
```javascript
// Get users from Clerk
const { Clerk } = require('@clerk/clerk-sdk-node');
const clerk = Clerk({ apiKey: process.env.CLERK_API_KEY });

const users = await clerk.users.getUserList({
  limit: 100,
  offset: 0
});

const formattedUsers = users.map(user => ({
  id: user.id,
  firstName: user.firstName || '',
  lastName: user.lastName || '',
  fullName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username || user.id,
  emailAddress: user.emailAddresses?.[0]?.emailAddress || '',
  imageUrl: user.imageUrl || '',
  username: user.username || ''
}));
```

## 🔐 Authentication & Security

### Environment Variables Required

```bash
# Required for user management
CLERK_API_KEY=your_clerk_api_key_here

# Existing MongoDB and CORS settings
MONGODB_URI=your_mongodb_connection_string
FRONTEND_URL=https://your-frontend-domain.com
```

### Authentication Middleware

The task assignment endpoints use the existing Clerk authentication:
- `requireAuth.optional` for task creation/updates (graceful fallback)
- Authentication required for `/api/my-tasks` endpoint
- User identity extracted from JWT tokens

## 🎯 Frontend Integration Points

### 1. Task Assignment Component

**Expected API Calls:**
```javascript
// Get users for dropdown
fetch('/api/users')

// Create task with assignment
fetch('/api/simple-create-task', {
  method: 'POST',
  body: JSON.stringify({
    title: 'Task Title',
    assignedUserId: 'user_123',
    // ... other fields
  })
})

// Update task assignment
fetch('/api/tasks/task_id', {
  method: 'PUT',
  body: JSON.stringify({
    assignedUserId: 'user_456'
  })
})
```

### 2. Personal Board

**Expected API Calls:**
```javascript
// Get tasks for current user
fetch('/api/my-tasks', {
  headers: {
    'Authorization': `Bearer ${userToken}`
  }
})

// Get tasks for specific user
fetch('/tasks/user/user_123')
```

## 🔄 Migration Notes

### Backward Compatibility

✅ **Fully backward compatible:**
- Existing tasks without `assignedUserId` will have `null` value
- All existing functionality remains unchanged
- No database migration required

### Data Consistency

- Tasks created before this update: `assignedUserId: null`
- Tasks created after this update: `assignedUserId: "user_id" or null`
- Frontend gracefully handles both cases

## 🧪 Testing Scenarios

### 1. Task Assignment
- ✅ Create task with assignment
- ✅ Create task without assignment  
- ✅ Update task assignment
- ✅ Remove task assignment (set to null)

### 2. User Queries
- ✅ Get tasks for valid user ID
- ✅ Get tasks for invalid user ID (returns empty array)
- ✅ Get tasks for user with no assignments (returns empty array)

### 3. Error Handling
- ✅ Missing CLERK_API_KEY (returns empty arrays)
- ✅ Clerk API failures (graceful fallback)
- ✅ Database connection issues (empty arrays)

## 🚀 Deployment Checklist

### Before Deployment
- [ ] Set `CLERK_API_KEY` environment variable
- [ ] Test user fetching endpoint
- [ ] Verify task assignment in database
- [ ] Test personal board functionality

### After Deployment
- [ ] Verify `/api/users` returns user list
- [ ] Test task creation with assignment
- [ ] Confirm personal board shows assigned tasks
- [ ] Monitor logs for any authentication issues

## 📋 API Documentation Summary

### New Task Fields
- `assignedUserId` (string, optional): Clerk user ID

### New Endpoints
- `GET /api/users` - List all users
- `GET /api/users/:userId` - Get specific user
- `GET /api/users/:userId/tasks` - Get tasks for specific user (with board info)
- `GET /api/my-tasks` - Get current user's tasks
- `GET /tasks/user/:userId` - Get tasks for specific user (Mongoose route)

### Updated Endpoints
- `POST /api/simple-create-task` - Now accepts `assignedUserId`
- `POST /api/tasks` - Now accepts `assignedUserId`
- `PUT /api/tasks/:id` - Now accepts `assignedUserId` updates

---

This implementation provides a complete task assignment system that integrates seamlessly with Clerk user management while maintaining full backward compatibility with existing functionality. 