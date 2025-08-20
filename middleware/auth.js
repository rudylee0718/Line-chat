// middleware/auth.js
const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  try {
    const token = req.headers.authorization.split(' ')[1]; // 從 "Bearer TOKEN" 中取得 Token
    const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
    // 將使用者 ID 和其他資訊存入 req.user 物件中，這是 Express 的常見慣例
    // 這樣在路由中就可以直接使用 req.user.userId 或 req.user.id
    req.user = { userId: decodedToken.userId }; 
    next(); // 繼續執行下一個中介軟體或控制器
  } catch (error) {
    return res.status(401).json({ message: '認證失敗！' });
  }
};