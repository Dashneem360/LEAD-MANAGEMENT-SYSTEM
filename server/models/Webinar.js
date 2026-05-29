const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const Webinar = sequelize.define('Webinar', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  _id: { type: DataTypes.VIRTUAL, get() { return this.id; } },
  title: { type: DataTypes.STRING, allowNull: false },
  description: DataTypes.TEXT,
  scheduledAt: { type: DataTypes.DATE, allowNull: false },
  duration: { type: DataTypes.INTEGER, defaultValue: 60 },
  link: DataTypes.STRING,
  youtubeLink: DataTypes.STRING,
  zoomLink: DataTypes.STRING,
  platform: {
    type: DataTypes.ENUM('zoom', 'google_meet', 'youtube', 'teams', 'other'),
    defaultValue: 'zoom'
  },
  status: {
    type: DataTypes.ENUM('upcoming', 'live', 'completed', 'cancelled'),
    defaultValue: 'upcoming'
  },
  createdById: DataTypes.UUID,
  totalInvited: { type: DataTypes.INTEGER, defaultValue: 0 },
  totalAttended: { type: DataTypes.INTEGER, defaultValue: 0 },
  notes: DataTypes.TEXT
}, {
  tableName: 'webinars',
  timestamps: true
});

module.exports = Webinar;
