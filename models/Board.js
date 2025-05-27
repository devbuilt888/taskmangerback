const mongoose = require('mongoose');
const { cleanObjectIdString } = require('../utils');

const BoardSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  isShared: {
    type: Boolean,
    default: true
  },
  columns: [{
    id: {
      type: String,
      required: true
    },
    title: {
      type: String,
      required: true
    },
    taskIds: {
      type: [String],
      default: []
    }
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt timestamp before saving
BoardSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Define a standard set of column names/ids for mapping
BoardSchema.statics.getStandardColumns = function() {
  return [
    {
      id: 'todo',
      title: 'To Do',
      taskIds: []
    },
    {
      id: 'in-progress',
      title: 'In Progress',
      taskIds: []
    },
    {
      id: 'done',
      title: 'Done',
      taskIds: []
    }
  ];
};

// Helper method to find the appropriate column ID by concept
BoardSchema.methods.findColumnIdByType = function(columnType) {
  // Map of standard column types to potential matching IDs and titles
  const columnMappings = {
    'todo': {
      ids: ['todo', 'to-do', 'to_do', 'column-1'],
      titleMatches: ['todo', 'to do', 'backlog', 'not started']
    },
    'in-progress': {
      ids: ['in-progress', 'inprogress', 'in_progress', 'column-2'],
      titleMatches: ['in progress', 'doing', 'started', 'working']
    },
    'done': {
      ids: ['done', 'completed', 'finished', 'column-3'],
      titleMatches: ['done', 'completed', 'finished']
    }
  };
  
  const mapping = columnMappings[columnType];
  if (!mapping) return null;
  
  // First check for exact ID match
  const idMatch = this.columns.find(col => mapping.ids.includes(col.id));
  if (idMatch) return idMatch.id;
  
  // Then check for title match
  const titleMatch = this.columns.find(col => {
    const lowerTitle = col.title.toLowerCase();
    return mapping.titleMatches.some(match => lowerTitle.includes(match));
  });
  if (titleMatch) return titleMatch.id;
  
  // If no match found, return the first column
  return this.columns.length > 0 ? this.columns[0].id : null;
};

module.exports = mongoose.model('Board', BoardSchema); 