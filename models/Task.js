const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Task schema definition
const TaskSchema = new Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  boardId: {
    type: String,
    required: true
  },
  columnId: {
    type: String,
    required: true
  },
  text: {
    type: String,
    required: true
  },
  color: {
    type: String,
    default: 'blue'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Task', TaskSchema); 