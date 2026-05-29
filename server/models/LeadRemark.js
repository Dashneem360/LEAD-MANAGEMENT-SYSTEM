const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const LeadRemark = sequelize.define('LeadRemark', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  _id: { type: DataTypes.VIRTUAL, get() { return this.id; } },
  leadId: { type: DataTypes.UUID, allowNull: false },
  text: { type: DataTypes.TEXT, allowNull: false },
  addedById: DataTypes.UUID,
  addedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, {
  tableName: 'lead_remarks',
  timestamps: false
});

module.exports = LeadRemark;
