const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    trim: true
  },
  text: {
    type: String,
    required: true,
    maxLength: 500
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  isSystem: {
    type: Boolean,
    default: false
  }
});

module.exports = mongoose.model('Message', messageSchema);