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

// Render 預設會提供一個名為 DATABASE_URL 的環境變數
// 它包含了完整的連線字串，包含 SSL 相關設定
const sequelize = new Sequelize(process.env.DATABASE_URL, {
  // 指定資料庫方言
  dialect: 'postgres',
  // 這行可以幫助 Sequelize 正確解析 DATABASE_URL
  protocol: 'postgres',
  // 透過這行，Sequelize 會自動處理 SSL 憑證
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false
    }
  },
  // 如果你不想在終端機看到所有 SQL 查詢，可以設為 false
  logging: false
});

module.exports = sequelize;