const mongoose = require('mongoose');

/**
 * Helper functions for working with MongoDB ObjectIds
 */

/**
 * Safely converts a string to a MongoDB ObjectId
 * @param {string|ObjectId} id - The ID to convert
 * @returns {ObjectId|null} - The ObjectId or null if invalid
 */
function toObjectId(id) {
  if (!id) return null;
  
  // If already an ObjectId, return it
  if (id instanceof mongoose.Types.ObjectId) return id;
  
  // If string, clean it and convert
  if (typeof id === 'string') {
    // Remove any non-hex characters
    const cleaned = id.replace(/[^0-9a-f]/gi, '');
    // Check if it's a valid ObjectId now
    if (cleaned.length === 24 && mongoose.Types.ObjectId.isValid(cleaned)) {
      return mongoose.Types.ObjectId(cleaned);
    }
  }
  
  // For other cases, try direct conversion
  try {
    if (mongoose.Types.ObjectId.isValid(id)) {
      return mongoose.Types.ObjectId(id);
    }
  } catch (err) {
    console.error('Error converting to ObjectId:', err);
  }
  
  return null;
}

/**
 * Validates if a string can be converted to a valid ObjectId
 * @param {string} id - The ID to validate
 * @returns {boolean} - Whether the ID is valid
 */
function isValidObjectId(id) {
  return toObjectId(id) !== null;
}

/**
 * Cleans a string to make it suitable for ObjectId conversion
 * @param {string} id - The ID to clean
 * @returns {string} - The cleaned ID string
 */
function cleanObjectIdString(id) {
  if (!id) return '';
  
  const str = id.toString();
  // Extract 24-character hex ID if embedded in a longer string
  const hexMatch = str.match(/[0-9a-f]{24}/i);
  return hexMatch ? hexMatch[0] : str.replace(/[^0-9a-f]/gi, '');
}

module.exports = {
  toObjectId,
  isValidObjectId,
  cleanObjectIdString
}; 