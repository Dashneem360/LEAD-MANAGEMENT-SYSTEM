const mongoose = require('mongoose');

const RemarkSchema = new mongoose.Schema({
  text: { type: String, required: true },
  addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  addedAt: { type: Date, default: Date.now }
});

const LeadSchema = new mongoose.Schema({
  // Basic Info
  name: { type: String, required: true, trim: true },
  phone: { type: String, required: true },
  alternatePhone: { type: String },
  email: { type: String, lowercase: true },
  city: { type: String },
  state: { type: String },
  source: {
    type: String,
    enum: ['google_sheet', 'manual', 'referral', 'website', 'social_media', 'other'],
    default: 'manual'
  },

  // Lead Status
  status: {
    type: String,
    enum: ['new', 'contacted', 'interested', 'not_interested', 'nurturing', 'converted', 'lost'],
    default: 'new'
  },
  priority: { type: String, enum: ['high', 'medium', 'low'], default: 'medium' },

  // Assignment
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  assignedAt: { type: Date },

  // Webinar
  webinarStatus: {
    type: String,
    enum: ['not_invited', 'invited', 'registered', 'attended', 'missed'],
    default: 'not_invited'
  },
  webinarSeenAt: { type: Date },
  webinarLink: { type: String },

  // Calling Info
  callCount: { type: Number, default: 0 },
  lastCalledAt: { type: Date },
  callDuration: { type: Number, default: 0 }, // in seconds

  // Followup
  nextFollowupDate: { type: Date },
  lastFollowupDate: { type: Date },
  followupCount: { type: Number, default: 0 },

  // Remarks
  remarks: [RemarkSchema],
  latestRemark: { type: String },

  // Financial
  dealValue: { type: Number, default: 0 },
  commission: { type: Number, default: 0 },

  // Google Sheet Tracking
  sheetRowIndex: { type: Number },
  sheetId: { type: String },
  lastSyncedAt: { type: Date },

  // Extra Fields
  product: { type: String },
  notes: { type: String },
  tags: [{ type: String }],

  isActive: { type: Boolean, default: true }
}, { timestamps: true });

LeadSchema.index({ phone: 1 });
LeadSchema.index({ assignedTo: 1 });
LeadSchema.index({ status: 1 });
LeadSchema.index({ nextFollowupDate: 1 });

module.exports = mongoose.model('Lead', LeadSchema);
