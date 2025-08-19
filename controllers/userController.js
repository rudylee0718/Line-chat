// controllers/userController.js
const User = require('../models/user');
// 引入 Sequelize 的運算子，用於模糊搜尋
const { Op } = require('sequelize'); 

// 獲取所有使用者列表
exports.getUsers = async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: ['id', 'username'] // 只回傳 id 和 username，保護使用者資料
    });
    res.status(200).json(users);
  } catch (error) {
    console.error('獲取使用者列表失敗:', error);
    res.status(500).json({ message: '獲取使用者列表失敗。' });
  }
};

// 根據使用者名稱搜尋使用者
exports.searchUsers = async (req, res) => {
    // 從查詢參數中獲取搜尋關鍵字 'q'
    const { q } = req.query;

    // 檢查搜尋關鍵字是否為空
    if (!q) {
        // 如果沒有關鍵字，可以回傳所有使用者或空陣列
        return res.status(200).json([]);
    }

    try {
        // 使用 Sequelize 的 findAll 和 Op.iLike 進行不區分大小寫的模糊搜尋
        const users = await User.findAll({
            where: {
                username: {
                    [Op.iLike]: `%${q}%`
                }
            },
            attributes: ['id', 'username'] // 只回傳 id 和 username
        });

        // 回傳找到的使用者列表
        res.status(200).json(users);

    } catch (err) {
        console.error('搜尋使用者失敗:', err);
        res.status(500).json({ message: '伺服器錯誤，無法搜尋使用者。' });
    }
};
