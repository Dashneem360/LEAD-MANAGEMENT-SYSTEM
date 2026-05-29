const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const Message = sequelize.define('Message', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  _id: { type: DataTypes.VIRTUAL, get() { return this.id; } },
  fromId: { type: DataTypes.UUID, allowNull: false },
  toId: { type: DataTypes.UUID, allowNull: false },
  type: { type: DataTypes.ENUM('text', 'voice'), defaultValue: 'text' },
  content: DataTypes.TEXT,
  audioUrl: DataTypes.STRING,
  isRead: { type: DataTypes.BOOLEAN, defaultValue: false },
  whatsappSent: { type: DataTypes.BOOLEAN, defaultValue: false }
}, {
  tableName: 'messages',
  timestamps: true
});

module.exports = Message;
