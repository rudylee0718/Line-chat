// // config/database.js
// require('dotenv').config();

// const { Sequelize } = require('sequelize');

// const sequelize = new Sequelize(
//   process.env.DB_NAME,
//   process.env.DB_USER,
//   process.env.DB_PASSWORD,
//   {
//     host: process.env.DB_HOST,
//     dialect: 'postgres',
//     logging: false,
//     port: process.env.DB_PORT,
//     dialectOptions: {
//       ssl: {
//         require: true, // 這會強制使用 SSL 連線
//         rejectUnauthorized: false, // 這會允許連線到 Render 的自簽憑證
//       },
//     },
//   }
// );

// module.exports = sequelize;

// config/database.js
require('dotenv').config();

const { Sequelize } = require('sequelize');

// 檢查 DATABASE_URL 是否存在，如果不存在則拋出明確的錯誤
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set!');
}

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  protocol: 'postgres',
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false
    }
  },
  logging: false
});

module.exports = sequelize;