// middleware/auth.js
const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  try {
    // 從 "Bearer TOKEN" 中取得 Token，如果沒有授權標頭，會跳到 catch
    const token = req.headers.authorization.split(' ')[1];
    const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
    
    // 修正: 將使用者 ID 存入 req.user.id，與你的路由保持一致
    req.user = { id: decodedToken.userId }; 
    
    // 繼續執行下一個中介軟體或控制器
    next(); 
  } catch (error) {
    // 認證失敗時，返回 401 狀態碼
    return res.status(401).json({ message: '認證失敗！' });
  }
};