// middleware/auth.js
const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  try {
    const token = req.headers.authorization.split(' ')[1]; // 從 "Bearer TOKEN" 中取得 Token
    const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
    req.userData = { userId: decodedToken.userId }; // 將使用者 ID 存入請求物件中
    next(); // 繼續執行下一個中介軟體或控制器
  } catch (error) {
    return res.status(401).json({ message: '認證失敗！' });
  }
};