const mongoose = require('mongoose');

const FollowupSchema = new mongoose.Schema({
  lead: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', required: true },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  scheduledDate: { type: Date, required: true },
  scheduledTime: { type: String }, // "10:30"

  status: {
    type: String,
    enum: ['pending', 'completed', 'missed', 'rescheduled', 'cancelled'],
    default: 'pending'
  },

  type: {
    type: String,
    enum: ['call', 'whatsapp', 'email', 'meeting', 'demo', 'video_call'],
    default: 'call'
  },
  meetingLink: { type: String },

  // Outcome after completion
  outcome: {
    type: String,
    enum: ['interested', 'not_interested', 'nurturing', 'converted', 'no_answer', 'callback', 'other'],
  },

  remark: { type: String },
  duration: { type: Number, default: 0 }, // call duration in seconds

  completedAt: { type: Date },
  completedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  // If rescheduled
  rescheduledTo: { type: Date },
  rescheduledReason: { type: String },

  // Alert tracking
  alertSent: { type: Boolean, default: false },
  missedAlertSent: { type: Boolean, default: false },

  priority: { type: String, enum: ['high', 'medium', 'low'], default: 'medium' }
}, { timestamps: true });

FollowupSchema.index({ assignedTo: 1, scheduledDate: 1 });
FollowupSchema.index({ lead: 1 });
FollowupSchema.index({ status: 1 });

module.exports = mongoose.model('Followup', FollowupSchema);
