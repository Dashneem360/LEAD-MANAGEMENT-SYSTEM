const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const WebinarCandidate = sequelize.define('WebinarCandidate', {
  webinarId: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
  userId: { type: DataTypes.UUID, allowNull: false, primaryKey: true }
}, {
  tableName: 'webinar_candidates',
  timestamps: false
});

module.exports = WebinarCandidate;
