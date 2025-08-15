// controllers/userController.js
const User = require('../models/user');

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