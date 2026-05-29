const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const Lead = sequelize.define('Lead', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  _id: { type: DataTypes.VIRTUAL, get() { return this.id; } },
  name: { type: DataTypes.STRING, allowNull: false },
  phone: { type: DataTypes.STRING, allowNull: false },
  alternatePhone: DataTypes.STRING,
  email: DataTypes.STRING,
  city: DataTypes.STRING,
  state: DataTypes.STRING,
  source: {
    type: DataTypes.ENUM('google_sheet', 'manual', 'referral', 'website', 'social_media', 'other'),
    defaultValue: 'manual'
  },
  status: {
    type: DataTypes.ENUM('new', 'contacted', 'interested', 'not_interested', 'nurturing', 'converted', 'lost'),
    defaultValue: 'new'
  },
  priority: { type: DataTypes.ENUM('high', 'medium', 'low'), defaultValue: 'medium' },
  assignedToId: DataTypes.UUID,
  assignedById: DataTypes.UUID,
  assignedAt: DataTypes.DATE,
  webinarStatus: {
    type: DataTypes.ENUM('not_invited', 'invited', 'registered', 'attended', 'missed'),
    defaultValue: 'not_invited'
  },
  webinarSeenAt: DataTypes.DATE,
  webinarLink: DataTypes.STRING,
  callCount: { type: DataTypes.INTEGER, defaultValue: 0 },
  lastCalledAt: DataTypes.DATE,
  callDuration: { type: DataTypes.INTEGER, defaultValue: 0 },
  nextFollowupDate: DataTypes.DATE,
  lastFollowupDate: DataTypes.DATE,
  followupCount: { type: DataTypes.INTEGER, defaultValue: 0 },
  latestRemark: DataTypes.TEXT,
  dealValue: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  commission: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  sheetRowIndex: DataTypes.INTEGER,
  sheetId: DataTypes.STRING,
  lastSyncedAt: DataTypes.DATE,
  product: DataTypes.STRING,
  notes: DataTypes.TEXT,
  tags: { type: DataTypes.ARRAY(DataTypes.TEXT), defaultValue: [] },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true }
}, {
  tableName: 'leads',
  timestamps: true
});

module.exports = Lead;
