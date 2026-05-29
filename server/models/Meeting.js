const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const Meeting = sequelize.define('Meeting', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  _id: { type: DataTypes.VIRTUAL, get() { return this.id; } },
  title: { type: DataTypes.STRING, allowNull: false },
  scheduledAt: { type: DataTypes.DATE, allowNull: false },
  duration: { type: DataTypes.INTEGER, defaultValue: 30 },
  meetingLink: DataTypes.STRING,
  platform: { type: DataTypes.ENUM('zoom', 'google_meet', 'teams', 'other'), defaultValue: 'zoom' },
  organizerId: { type: DataTypes.UUID, allowNull: false },
  status: { type: DataTypes.ENUM('scheduled', 'completed', 'cancelled'), defaultValue: 'scheduled' },
  notes: DataTypes.TEXT
}, {
  tableName: 'meetings',
  timestamps: true
});

module.exports = Meeting;
