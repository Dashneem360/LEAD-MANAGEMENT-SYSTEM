const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const WebinarAttendee = sequelize.define('WebinarAttendee', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  _id: { type: DataTypes.VIRTUAL, get() { return this.id; } },
  webinarId: { type: DataTypes.UUID, allowNull: false },
  leadId: { type: DataTypes.UUID, allowNull: false },
  status: {
    type: DataTypes.ENUM('invited', 'registered', 'attended', 'missed'),
    defaultValue: 'invited'
  },
  markedById: DataTypes.UUID,
  markedAt: DataTypes.DATE
}, {
  tableName: 'webinar_attendees',
  timestamps: false
});

module.exports = WebinarAttendee;
