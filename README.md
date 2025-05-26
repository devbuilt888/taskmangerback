# Task Manager Server

This is the backend server for the Task Manager application, built with Node.js, Express, and MongoDB.

## Features

- MongoDB integration for persistent storage
- RESTful API for tasks and boards
- Authentication via Clerk
- Environment variable configuration

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create a `.env` file in the server directory with the following variables:
   ```
   # MongoDB Connection
   MONGODB_URI=mongodb+srv://username:<password>@cluster0.example.mongodb.net/taskmanager?retryWrites=true&w=majority

   # Clerk Authentication
   CLERK_API_KEY=your_clerk_api_key

   # Server Configuration
   PORT=5000
   ```

3. Replace the placeholders with your actual MongoDB connection string and Clerk API key.

4. Start the development server:
   ```bash
   npm run dev
   ```

## API Endpoints

### Tasks

- `GET /api/tasks/:boardId` - Get all tasks for a board
- `POST /api/tasks` - Create a new task
- `PUT /api/tasks/:id` - Update a task
- `DELETE /api/tasks/:id` - Delete a task
- `PATCH /api/tasks/:id/move` - Move a task to a different column

### Boards

- `GET /api/boards` - Get all boards for the authenticated user
- `GET /api/boards/:id` - Get a specific board
- `POST /api/boards` - Create a new board
- `PUT /api/boards/:id` - Update a board
- `DELETE /api/boards/:id` - Delete a board and all its tasks

## Authentication

All endpoints require authentication via Clerk. Include the JWT token in the Authorization header:

```
Authorization: Bearer your_jwt_token
``` 