// controllers/authController.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/user');

// 註冊邏輯
exports.register = async (req, res) => {
  try {
    const { username, password } = req.body;

    // 檢查使用者名稱是否已存在
    const existingUser = await User.findOne({ where: { username } });
    if (existingUser) {
      return res.status(409).json({ message: '使用者名稱已存在' });
    }

    // 密碼加密
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    // 建立新使用者
    const newUser = await User.create({
      username,
      password_hash,
    });

    res.status(201).json({ message: '註冊成功！', user: newUser });
  } catch (err) {
    res.status(500).json({ message: '伺服器錯誤', error: err.message });
  }
};

// 登入邏輯
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;

    // 檢查使用者是否存在
    const user = await User.findOne({ where: { username } });
    if (!user) {
      return res.status(404).json({ message: '使用者不存在' });
    }

    // 密碼比對
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: '密碼錯誤' });
    }

    // 產生 JWT Token
    // 注意：在 .env 檔中定義一個 JWT_SECRET，請勿寫死！
    const jwtSecret = process.env.JWT_SECRET; // 從環境變數中讀取金鑰 
    const token = jwt.sign({ userId: user.id }, jwtSecret, { expiresIn: '1h' });

    res.status(200).json({
      message: '登入成功！',
      token,
      user: {
        id: user.id,
        username: user.username,
      },
    });
  } catch (err) {
    res.status(500).json({ message: '伺服器錯誤', error: err.message });
  }
};