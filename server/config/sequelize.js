const { Sequelize } = require('sequelize');

const ssl = { rejectUnauthorized: false };

let sequelize;

if (process.env.DATABASE_URL) {
  sequelize = new Sequelize(process.env.DATABASE_URL.trim(), {
    dialect: 'postgres',
    dialectOptions: { ssl },
    logging: false
  });
} else {
  sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    {
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT) || 5432,
      dialect: 'postgres',
      dialectOptions: { ssl },
      logging: false
    }
  );
}

module.exports = sequelize;
