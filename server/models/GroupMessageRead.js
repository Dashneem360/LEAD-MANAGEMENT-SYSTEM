const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const GroupMessageRead = sequelize.define('GroupMessageRead', {
  messageId: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
  userId: { type: DataTypes.UUID, allowNull: false, primaryKey: true }
}, {
  tableName: 'group_message_reads',
  timestamps: false
});

module.exports = GroupMessageRead;
