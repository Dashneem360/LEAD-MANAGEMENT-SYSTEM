const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const GroupMember = sequelize.define('GroupMember', {
  groupId: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
  userId: { type: DataTypes.UUID, allowNull: false, primaryKey: true }
}, {
  tableName: 'group_members',
  timestamps: false
});

module.exports = GroupMember;
