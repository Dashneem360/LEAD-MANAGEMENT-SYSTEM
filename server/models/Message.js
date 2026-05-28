const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  from: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  to:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['text', 'voice'], default: 'text' },
  content:  { type: String },
  audioUrl: { type: String },
  isRead:       { type: Boolean, default: false },
  whatsappSent: { type: Boolean, default: false }
}, { timestamps: true });

MessageSchema.index({ from: 1, to: 1, createdAt: -1 });
MessageSchema.index({ to: 1, isRead: 1 });

module.exports = mongoose.model('Message', MessageSchema);
