// routes/messageRoutes.js
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth'); // 引入認證中介軟體
const messageController = require('../controllers/messageController');

router.get('/', authMiddleware, messageController.getMessages);

// 獲取與特定使用者的一對一對話紀錄
router.get('/:receiverId', authMiddleware, messageController.getConversation);

module.exports = router;