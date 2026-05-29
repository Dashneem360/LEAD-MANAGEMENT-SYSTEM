const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const GroupMessage = sequelize.define('GroupMessage', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  _id: { type: DataTypes.VIRTUAL, get() { return this.id; } },
  groupId: { type: DataTypes.UUID, allowNull: false },
  fromId: { type: DataTypes.UUID, allowNull: false },
  type: { type: DataTypes.ENUM('text', 'voice'), defaultValue: 'text' },
  content: DataTypes.TEXT,
  audioUrl: DataTypes.STRING
}, {
  tableName: 'group_messages',
  timestamps: true
});

module.exports = GroupMessage;
