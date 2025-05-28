/**
 * API Utilities for MongoDB Integration
 * 
 * This file contains utility functions for working with the Task Manager API
 * and MongoDB ObjectIds on the frontend.
 */

/**
 * Safely clean a MongoDB ObjectId string
 * @param {string} id - The ID to clean
 * @returns {string} - A cleaned 24-character hex string suitable for MongoDB
 */
function cleanMongoId(id) {
  if (!id) return '';
  
  // First try to extract a 24-character hex string (standard MongoDB ObjectId)
  const hexMatch = id.toString().match(/[0-9a-f]{24}/i);
  if (hexMatch) {
    return hexMatch[0];
  }
  
  // If no match, just remove any non-hex characters
  return id.toString().replace(/[^0-9a-f]/gi, '');
}

/**
 * Check if a string is a valid MongoDB ObjectId
 * @param {string} id - The ID to validate
 * @returns {boolean} - Whether the ID is a valid MongoDB ObjectId
 */
function isValidMongoId(id) {
  if (!id) return false;
  
  // Must be a string of 24 hex characters
  const cleaned = cleanMongoId(id);
  return cleaned.length === 24;
}

/**
 * Safely convert a boardId for API requests
 * @param {string} boardId - The board ID from the frontend
 * @returns {string} - A cleaned board ID ready for API use
 */
function prepareBoardId(boardId) {
  return cleanMongoId(boardId);
}

/**
 * Create a task with safer ID handling
 * @param {Object} taskData - The task data
 * @param {string} apiBaseUrl - The base URL for the API
 * @returns {Promise<Object>} - The created task
 */
async function createTaskSafely(taskData, apiBaseUrl = '') {
  // Ensure we have a clean board ID
  const cleanedData = {
    ...taskData,
    boardId: cleanMongoId(taskData.boardId)
  };
  
  try {
    const response = await fetch(`${apiBaseUrl}/api/simple-create-task`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(cleanedData)
    });
    
    return await response.json();
  } catch (error) {
    console.error('Error creating task:', error);
    throw error;
  }
}

/**
 * Get tasks for a board with safer ID handling
 * @param {string} boardId - The board ID
 * @param {string} apiBaseUrl - The base URL for the API
 * @returns {Promise<Array>} - The tasks for the board
 */
async function getBoardTasksSafely(boardId, apiBaseUrl = '') {
  const cleanId = cleanMongoId(boardId);
  
  try {
    const response = await fetch(`${apiBaseUrl}/tasks/board/${cleanId}`);
    const data = await response.json();
    
    // Always ensure we return an array
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('Error fetching board tasks:', error);
    return [];
  }
}

/**
 * Get a board with all its tasks in a single request
 * @param {string} boardId - The board ID
 * @param {string} apiBaseUrl - The base URL for the API
 * @returns {Promise<Object>} - The board with its tasks
 */
async function getBoardWithTasks(boardId, apiBaseUrl = '') {
  const cleanId = cleanMongoId(boardId);
  
  try {
    const response = await fetch(`${apiBaseUrl}/api/board-with-tasks/${cleanId}`);
    return await response.json();
  } catch (error) {
    console.error('Error fetching board with tasks:', error);
    return { board: null, taskCount: 0 };
  }
}

/**
 * Get enhanced tasks for a board (with all details)
 * @param {string} boardId - The board ID
 * @param {string} apiBaseUrl - The base URL for the API
 * @returns {Promise<Array>} - The enhanced tasks for the board
 */
async function getEnhancedTasksForBoard(boardId, apiBaseUrl = '') {
  const cleanId = cleanMongoId(boardId);
  
  try {
    const response = await fetch(`${apiBaseUrl}/api/enhanced-tasks/${cleanId}`);
    const data = await response.json();
    
    // Always ensure we return an array
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('Error fetching enhanced tasks:', error);
    return [];
  }
}

/**
 * Delete a board and all its tasks
 * @param {string} boardId - The board ID to delete
 * @param {string} apiBaseUrl - The base URL for the API
 * @returns {Promise<Object>} - The result of the delete operation
 */
async function deleteBoard(boardId, apiBaseUrl = '') {
  const cleanId = cleanMongoId(boardId);
  
  try {
    const response = await fetch(`${apiBaseUrl}/api/board/${cleanId}`, {
      method: 'DELETE',
      headers: {
        'Accept': 'application/json'
      }
    });
    
    return await response.json();
  } catch (error) {
    console.error('Error deleting board:', error);
    return { 
      success: false, 
      error: error.message 
    };
  }
}

/**
 * Delete a specific task
 * @param {string} taskId - The task ID to delete
 * @param {string} apiBaseUrl - The base URL for the API
 * @returns {Promise<Object>} - The result of the delete operation
 */
async function deleteTask(taskId, apiBaseUrl = '') {
  const cleanId = cleanMongoId(taskId);
  
  try {
    const response = await fetch(`${apiBaseUrl}/api/task/${cleanId}`, {
      method: 'DELETE',
      headers: {
        'Accept': 'application/json'
      }
    });
    
    return await response.json();
  } catch (error) {
    console.error('Error deleting task:', error);
    return { 
      success: false, 
      error: error.message 
    };
  }
}

// Export the utilities for use in other scripts
window.TaskManagerUtils = {
  cleanMongoId,
  isValidMongoId,
  prepareBoardId,
  createTaskSafely,
  getBoardTasksSafely,
  getBoardWithTasks,
  getEnhancedTasksForBoard,
  deleteBoard,
  deleteTask
}; 