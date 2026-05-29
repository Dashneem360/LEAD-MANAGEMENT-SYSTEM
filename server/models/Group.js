const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const Group = sequelize.define('Group', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  _id: { type: DataTypes.VIRTUAL, get() { return this.id; } },
  name: { type: DataTypes.STRING, allowNull: false },
  createdById: { type: DataTypes.UUID, allowNull: false },
  lastMessage: { type: DataTypes.STRING, defaultValue: '' },
  lastMessageAt: DataTypes.DATE
}, {
  tableName: 'groups',
  timestamps: true
});

module.exports = Group;
