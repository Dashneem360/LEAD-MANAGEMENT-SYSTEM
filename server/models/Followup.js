const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const Followup = sequelize.define('Followup', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  _id: { type: DataTypes.VIRTUAL, get() { return this.id; } },
  leadId: { type: DataTypes.UUID, allowNull: false },
  assignedToId: { type: DataTypes.UUID, allowNull: false },
  assignedById: DataTypes.UUID,
  scheduledDate: { type: DataTypes.DATE, allowNull: false },
  scheduledTime: DataTypes.STRING,
  status: {
    type: DataTypes.ENUM('pending', 'completed', 'missed', 'rescheduled', 'cancelled'),
    defaultValue: 'pending'
  },
  type: {
    type: DataTypes.ENUM('call', 'whatsapp', 'email', 'meeting', 'demo', 'video_call'),
    defaultValue: 'call'
  },
  meetingLink: DataTypes.STRING,
  outcome: DataTypes.ENUM('interested', 'not_interested', 'nurturing', 'converted', 'no_answer', 'callback', 'other'),
  remark: DataTypes.TEXT,
  duration: { type: DataTypes.INTEGER, defaultValue: 0 },
  completedAt: DataTypes.DATE,
  completedById: DataTypes.UUID,
  rescheduledTo: DataTypes.DATE,
  rescheduledReason: DataTypes.STRING,
  alertSent: { type: DataTypes.BOOLEAN, defaultValue: false },
  missedAlertSent: { type: DataTypes.BOOLEAN, defaultValue: false },
  priority: { type: DataTypes.ENUM('high', 'medium', 'low'), defaultValue: 'medium' }
}, {
  tableName: 'followups',
  timestamps: true
});

module.exports = Followup;
