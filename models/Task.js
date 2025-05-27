const mongoose = require('mongoose');

// Helper function to safely convert string to ObjectId
function safeObjectId(v) {
  if (!v) return null;
  
  // If already an ObjectId, return it
  if (v instanceof mongoose.Types.ObjectId) return v;
  
  // If string, clean it and convert
  if (typeof v === 'string') {
    // Remove any non-hex characters
    const cleaned = v.replace(/[^0-9a-f]/gi, '');
    // Check if it's a valid ObjectId now
    if (cleaned.length === 24 && mongoose.Types.ObjectId.isValid(cleaned)) {
      return mongoose.Types.ObjectId(cleaned);
    }
  }
  
  // If we can't convert safely, return the original value
  // This will trigger a validation error if needed
  return v;
}

const TaskSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  boardId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Board',
    required: true,
    get: v => v ? v.toString() : null,
    set: safeObjectId
  },
  columnId: {
    type: String,
    required: true
  },
  isShared: {
    type: Boolean,
    default: true
  },
  color: {
    type: String,
    default: 'blue'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  dueDate: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  toJSON: { getters: true },
  toObject: { getters: true }
});

// Update the updatedAt timestamp before saving
TaskSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Add a pre-validation hook to ensure boardId is valid
TaskSchema.pre('validate', function(next) {
  // If boardId exists but isn't a valid ObjectId, try to fix it
  if (this.boardId && !(this.boardId instanceof mongoose.Types.ObjectId)) {
    try {
      const idString = this.boardId.toString();
      const cleaned = idString.replace(/[^0-9a-f]/gi, '');
      if (cleaned.length === 24 && mongoose.Types.ObjectId.isValid(cleaned)) {
        this.boardId = mongoose.Types.ObjectId(cleaned);
      }
    } catch (err) {
      console.error('Error converting boardId:', err);
      // Continue validation will handle the error
    }
  }
  next();
});

module.exports = mongoose.model('Task', TaskSchema); 