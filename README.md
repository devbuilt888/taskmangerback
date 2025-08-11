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
   
   # Frontend URL (for CORS)
   FRONTEND_URL=http://localhost:3000
   ```

3. Replace the placeholders with your actual MongoDB connection string and Clerk API key.

4. Start the development server:
   ```bash
   npm run dev
   ```

## Deployment to Vercel

This server can be deployed to Vercel as an API service for your frontend application.

1. Push your repository to GitHub

2. Connect to Vercel:
   - Create an account on [Vercel](https://vercel.com) if you don't have one
   - Create a new project and import your GitHub repository
   - Select "Other" as the framework preset

3. Configure the deployment:
   - Set the following environment variables in the Vercel dashboard:
     - `MONGODB_URI`: Your MongoDB connection string
     - `CLERK_API_KEY`: Your Clerk API key
     - `FRONTEND_URL`: The URL of your frontend application (for CORS)
   - Deployment settings:
     - Build Command: `npm install`
     - Output Directory: Leave empty
     - Install Command: `npm install`

4. Deploy the project:
   - Click "Deploy" and wait for the build to complete
   - Vercel will provide you with a deployment URL (e.g., `https://your-project.vercel.app`)

5. Update your frontend to use the new API URL:
   - Set the API base URL in your frontend to your Vercel deployment URL
   - Example: `https://your-project.vercel.app/api`

## CORS Configuration

This API includes comprehensive CORS configuration to allow requests from your frontend application. The following features are implemented:

- **Allowed Origins**: By default, the API allows requests from:
  - The URL specified in the `FRONTEND_URL` environment variable
  - `http://localhost:3000` (common React development server)
  - `http://localhost:5173` (common Vite development server)
  - `https://task-manager-frontend.vercel.app`
  - `https://bbglobalsolutions.org`

- **Vercel Headers**: The `vercel.json` file includes CORS headers for serverless deployments

- **Custom CORS Middleware**: A backup middleware ensures CORS headers are included in all responses, even error responses

To configure CORS for your specific frontend:
1. Set the `FRONTEND_URL` environment variable to your frontend's URL
2. For additional origins, modify the `allowedOrigins` array in `middleware/cors.js` and `server.js`

## API Endpoints

### Tasks

- `GET /api/tasks/:boardId` - Get all tasks for a board
- `GET /tasks/user/:userId` - Get all tasks assigned to a specific user
- `POST /api/tasks` - Create a new task (supports `assignedUserId` field)
- `POST /api/simple-create-task` - Simplified task creation (supports `assignedUserId` field)
- `PUT /api/tasks/:id` - Update a task (supports assignment changes)
- `DELETE /api/tasks/:id` - Delete a task
- `PATCH /api/tasks/:id/move` - Move a task to a different column

### Boards

- `GET /api/boards` - Get all boards for the authenticated user
- `GET /api/boards/:id` - Get a specific board
- `POST /api/boards` - Create a new board
- `PUT /api/boards/:id` - Update a board
- `DELETE /api/boards/:id` - Delete a board and all its tasks

### Users (Clerk Integration)

- `GET /api/users` - Get all users from Clerk (for task assignment)
- `GET /api/users/:userId` - Get a specific user by ID
- `GET /api/my-tasks` - Get tasks assigned to the current authenticated user

### Health Checks

- `GET /api/health` - Returns status "ok" with a message (for API health)
- `GET /health` - Returns status "ok" with current timestamp (for server health)

## Authentication

All endpoints require authentication via Clerk. Include the JWT token in the Authorization header:

```
Authorization: Bearer your_jwt_token
```