const mongoose = require('mongoose');

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

module.exports = mongoose.model('Board', BoardSchema); 