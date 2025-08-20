// friendRequestRoutes.js
const express = require('express');
const router = express.Router();
// 引入你定義好的 Sequelize 模型
const FriendRequest = require('../models/FriendRequest');
const User = require('../models/User'); // 假設你需要 User 模型來進行關聯查詢

// --- 路由 ---

/**
 * @route   POST /api/friends/request
 * @desc    發送好友請求
 * @access  Private (需要認證)
 * @body    { receiverId: '要發送請求的用戶 ID' }
 */
router.post('/request', async (req, res) => {
    try {
        const { receiverId } = req.body;
        const senderId = req.user.id;

        if (!receiverId) {
            return res.status(400).json({ message: '發送請求失敗：缺少接收者 ID。' });
        }

        if (senderId === receiverId) {
            return res.status(400).json({ message: '你無法向自己發送好友請求。' });
        }

        // 使用 Sequelize 來檢查是否已存在請求或已是好友
        const existingRequest = await FriendRequest.findOne({
            where: {
                // 檢查是否已存在待處理請求
                // 或是雙方已經是好友（無論是誰發起的請求）
                [Sequelize.Op.or]: [
                    { senderId: senderId, recipientId: receiverId, status: 'pending' },
                    { senderId: receiverId, recipientId: senderId, status: 'pending' },
                    { 
                        [Sequelize.Op.and]: [
                            { 
                                [Sequelize.Op.or]: [
                                    { senderId: senderId, recipientId: receiverId },
                                    { senderId: receiverId, recipientId: senderId }
                                ]
                            },
                            { status: 'accepted' }
                        ]
                    }
                ]
            }
        });

        if (existingRequest) {
            if (existingRequest.status === 'pending') {
                return res.status(409).json({ message: '好友請求已存在。' });
            } else if (existingRequest.status === 'accepted') {
                return res.status(409).json({ message: '你們已經是好友了。' });
            }
        }

        // 使用 Sequelize 插入新的好友請求
        const newRequest = await FriendRequest.create({
            senderId,
            recipientId: receiverId,
            status: 'pending'
        });

        res.status(200).json({ 
            message: '好友請求發送成功。', 
            request: {
                _id: newRequest.id,
                sender: newRequest.senderId,
                recipient: newRequest.recipientId,
                status: newRequest.status,
            }
        });
    } catch (error) {
        console.error('發送好友請求失敗:', error);
        res.status(500).json({ message: '伺服器錯誤，無法發送好友請求。' });
    }
});

/**
 * @route   GET /api/friends/requests
 * @desc    獲取所有待處理的好友請求
 * @access  Private (需要認證)
 */
router.get('/requests', async (req, res) => {
    try {
        const currentUserId = req.user.id;

        // 使用 Sequelize 關聯查詢，並包含 sender 的資訊
        const pendingRequests = await FriendRequest.findAll({
            where: {
                recipientId: currentUserId,
                status: 'pending'
            },
            include: [{
                model: User,
                as: 'sender', // 假設你在模型關聯中設定了別名
                attributes: ['id', 'username', 'avatar']
            }],
            order: [['createdAt', 'DESC']]
        });
        
        // 格式化查詢結果
        const formattedRequests = pendingRequests.map(request => ({
            _id: request.id,
            createdAt: request.createdAt,
            sender: {
                _id: request.sender.id,
                username: request.sender.username,
                avatar: request.sender.avatar
            }
        }));

        res.status(200).json({ requests: formattedRequests });
    } catch (error) {
        console.error('獲取好友請求失敗:', error);
        res.status(500).json({ message: '伺服器錯誤，無法獲取好友請求。' });
    }
});

/**
 * @route   POST /api/friends/reject
 * @desc    拒絕一個好友請求
 * @access  Private (需要認證)
 * @body    { requestId: '...' }
 */
router.post('/reject', async (req, res) => {
    try {
        const { requestId } = req.body;
        const currentUserId = req.user.id; 

        if (!requestId) {
            return res.status(400).json({ message: '缺少好友請求 ID。' });
        }

        // 檢查請求是否存在且屬於當前用戶
        const requestToReject = await FriendRequest.findOne({
            where: {
                id: requestId,
                recipientId: currentUserId,
                status: 'pending'
            }
        });

        if (!requestToReject) {
            return res.status(404).json({ message: '找不到此好友請求或你無權拒絕。' });
        }
        
        // 使用 Sequelize 更新請求狀態
        await requestToReject.update({ status: 'rejected' });

        res.status(200).json({ message: '好友請求已成功拒絕。', requestId });
    } catch (error) {
        console.error('拒絕好友請求失敗:', error);
        res.status(500).json({ message: '伺服器錯誤，無法拒絕好友請求。' });
    }
});

module.exports = router;
