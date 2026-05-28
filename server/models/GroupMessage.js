const mongoose = require('mongoose');

const GroupMessageSchema = new mongoose.Schema({
  group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true },
  from:  { type: mongoose.Schema.Types.ObjectId, ref: 'User',  required: true },
  type:  { type: String, enum: ['text', 'voice'], default: 'text' },
  content:  { type: String },
  audioUrl: { type: String },
  readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
}, { timestamps: true });

GroupMessageSchema.index({ group: 1, createdAt: 1 });

module.exports = mongoose.model('GroupMessage', GroupMessageSchema);
