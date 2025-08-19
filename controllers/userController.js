// controllers/userController.js
const User = require('../models/user');
const pool = require('../config/database'); // 確保這行已經存在

// 獲取所有使用者列表
exports.getUsers = async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: ['id', 'username'] // 只回傳 id 和 username，保護使用者資料
    });
    res.status(200).json(users);
  } catch (error) {
    console.error('Failed to get users:', error);
    res.status(500).json({ message: '獲取使用者列表失敗。' });
  }
};
exports.searchUsers = async (req, res) => {
    // 從查詢參數中獲取搜尋關鍵字 'q'
    const { q } = req.query;

    // 檢查搜尋關鍵字是否為空
    if (!q) {
        return res.status(400).json({ msg: '搜尋關鍵字不能為空' });
    }

    try {
        // 使用 SQL 查詢來搜尋使用者名稱
        const result = await pool.query(
            "SELECT id, username FROM Users WHERE username ILIKE $1",
            [`%${q}%`]
        );

        // 回傳找到的使用者列表，如果沒有找到則回傳空陣列
        res.json(result.rows);

    } catch (err) {
        console.error(err.message);
        res.status(500).send('伺服器錯誤');
    }
};