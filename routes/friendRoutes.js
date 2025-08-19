const express = require('express');
const router = express.Router();
const { sendFriendRequest, acceptFriendRequest, getFriendRequests } = require('../controllers/friendRequestController');
const { protect } = require('../middleware/auth');

// 發送好友請求
router.post('/request', protect, sendFriendRequest);

// 接受好友請求
router.post('/accept', protect, acceptFriendRequest);

// 獲取好友請求列表
router.get('/requests', protect, getFriendRequests);

module.exports = router;