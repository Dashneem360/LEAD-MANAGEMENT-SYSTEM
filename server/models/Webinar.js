const mongoose = require('mongoose');

const AttendeeSchema = new mongoose.Schema({
  lead: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead' },
  status: {
    type: String,
    enum: ['invited', 'registered', 'attended', 'missed'],
    default: 'invited'
  },
  markedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  markedAt: { type: Date }
});

const WebinarSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  scheduledAt: { type: Date, required: true },
  duration: { type: Number, default: 60 }, // minutes
  link: { type: String },       // primary/zoom link
  youtubeLink: { type: String },
  zoomLink:    { type: String },
  platform: {
    type: String,
    enum: ['zoom', 'google_meet', 'youtube', 'teams', 'other'],
    default: 'zoom'
  },
  status: {
    type: String,
    enum: ['upcoming', 'live', 'completed', 'cancelled'],
    default: 'upcoming'
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  candidates: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  attendees: [AttendeeSchema],
  totalInvited: { type: Number, default: 0 },
  totalAttended: { type: Number, default: 0 },
  notes: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Webinar', WebinarSchema);
