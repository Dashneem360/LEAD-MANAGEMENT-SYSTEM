const { Sequelize } = require('sequelize');

const databaseUrl = process.env.DATABASE_URL ||
  `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`;

const sequelize = new Sequelize(databaseUrl, {
  dialect: 'postgres',
  dialectOptions: {
    ssl: { rejectUnauthorized: false }
  },
  logging: false
});

module.exports = sequelize;
