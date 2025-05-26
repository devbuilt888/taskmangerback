const mongoose = require('mongoose');

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
    get: v => v.toString(),
    set: v => (typeof v === 'string' && mongoose.Types.ObjectId.isValid(v)) ? 
             mongoose.Types.ObjectId(v) : v
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

module.exports = mongoose.model('Task', TaskSchema); 