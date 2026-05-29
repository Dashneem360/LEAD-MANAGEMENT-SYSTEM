const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const Notification = sequelize.define('Notification', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  _id: { type: DataTypes.VIRTUAL, get() { return this.id; } },
  userId: { type: DataTypes.UUID, allowNull: false },
  type: {
    type: DataTypes.ENUM('missed_followup', 'upcoming_followup', 'lead_assigned', 'webinar_reminder', 'system'),
    allowNull: false
  },
  title: { type: DataTypes.STRING, allowNull: false },
  message: { type: DataTypes.TEXT, allowNull: false },
  relatedLeadId: DataTypes.UUID,
  relatedFollowupId: DataTypes.UUID,
  isRead: { type: DataTypes.BOOLEAN, defaultValue: false },
  readAt: DataTypes.DATE
}, {
  tableName: 'notifications',
  timestamps: true
});

module.exports = Notification;
