const mongoose = require('mongoose');

const MeetingSchema = new mongoose.Schema({
  title:       { type: String, required: true },
  scheduledAt: { type: Date, required: true },
  duration:    { type: Number, default: 30 }, // minutes
  meetingLink: { type: String },
  platform:    { type: String, enum: ['zoom', 'google_meet', 'teams', 'other'], default: 'zoom' },
  organizer:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  participants:{ type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], default: [] },
  status:      { type: String, enum: ['scheduled', 'completed', 'cancelled'], default: 'scheduled' },
  notes:       { type: String }
}, { timestamps: true });

MeetingSchema.index({ organizer: 1, scheduledAt: -1 });
MeetingSchema.index({ participants: 1 });

module.exports = mongoose.model('Meeting', MeetingSchema);
