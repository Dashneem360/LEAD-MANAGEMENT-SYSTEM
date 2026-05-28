const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: {
    type: String,
    enum: ['missed_followup', 'upcoming_followup', 'lead_assigned', 'webinar_reminder', 'system'],
    required: true
  },
  title: { type: String, required: true },
  message: { type: String, required: true },
  relatedLead: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead' },
  relatedFollowup: { type: mongoose.Schema.Types.ObjectId, ref: 'Followup' },
  isRead: { type: Boolean, default: false },
  readAt: { type: Date }
}, { timestamps: true });

NotificationSchema.index({ user: 1, isRead: 1 });

module.exports = mongoose.model('Notification', NotificationSchema);
