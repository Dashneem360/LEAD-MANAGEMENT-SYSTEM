const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');
const sequelize = require('../config/sequelize');

const User = sequelize.define('User', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  _id: { type: DataTypes.VIRTUAL, get() { return this.id; } },
  name: { type: DataTypes.STRING, allowNull: false },
  email: { type: DataTypes.STRING, allowNull: false, unique: true },
  password: { type: DataTypes.STRING, allowNull: false },
  phone: DataTypes.STRING,
  role: { type: DataTypes.ENUM('admin', 'manager', 'member'), defaultValue: 'member' },
  companyCode: { type: DataTypes.STRING, defaultValue: 'DASHNEEM' },
  candidateId: { type: DataTypes.STRING, unique: true },
  avatar: { type: DataTypes.STRING, defaultValue: '' },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
  stats: {
    type: DataTypes.JSONB,
    defaultValue: { totalLeads: 0, convertedLeads: 0, totalFollowups: 0, completedFollowups: 0, missedFollowups: 0 }
  },
  earnings: {
    type: DataTypes.JSONB,
    defaultValue: { total: 0, thisMonth: 0, thisWeek: 0 }
  },
  lastLogin: DataTypes.DATE
}, {
  tableName: 'users',
  timestamps: true
});

User.beforeSave(async (user) => {
  if (user.changed('password')) {
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(user.password, salt);
  }
  if (user.email) user.setDataValue('email', user.email.toLowerCase());
});

User.prototype.matchPassword = async function(enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

module.exports = User;
