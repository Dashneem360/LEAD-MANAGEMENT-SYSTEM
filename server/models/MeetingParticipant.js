const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const MeetingParticipant = sequelize.define('MeetingParticipant', {
  meetingId: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
  userId: { type: DataTypes.UUID, allowNull: false, primaryKey: true }
}, {
  tableName: 'meeting_participants',
  timestamps: false
});

module.exports = MeetingParticipant;
