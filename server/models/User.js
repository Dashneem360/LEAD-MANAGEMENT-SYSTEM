const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true, minlength: 6 },
  phone: { type: String },
  role: { type: String, enum: ['admin', 'manager', 'member'], default: 'member' },
  companyCode: { type: String, default: 'DASHNEEM', index: true },
  candidateId: { type: String, index: true, sparse: true },
  avatar: { type: String, default: '' },
  isActive: { type: Boolean, default: true },
  teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
  earnings: {
    total: { type: Number, default: 0 },
    thisMonth: { type: Number, default: 0 },
    thisWeek: { type: Number, default: 0 }
  },
  stats: {
    totalLeads: { type: Number, default: 0 },
    convertedLeads: { type: Number, default: 0 },
    totalFollowups: { type: Number, default: 0 },
    completedFollowups: { type: Number, default: 0 },
    missedFollowups: { type: Number, default: 0 }
  },
  lastLogin: { type: Date }
}, { timestamps: true });

UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

UserSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', UserSchema);
