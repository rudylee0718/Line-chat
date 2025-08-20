// friendRequestRoutes.js
const express = require('express');
const router = express.Router();
const { Pool } = require('pg');

// --- PostgreSQL 資料庫連線設定 ---
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

// --- 路由 ---

/**
 * @route   POST /api/friends/request
 * @desc    發送好友請求
 * @access  Private (需要認證)
 * @body    { receiverId: '要發送請求的用戶 ID' }
 */
router.post('/request', async (req, res) => {
    try {
        // 從 Flutter 請求主體中獲取 receiverId
        const { receiverId } = req.body;
        
        // 確保你的認證中介軟體 (middleware) 已經將用戶 ID 附加到 req.user 上
        const senderId = req.user.id; 

        // 檢查請求主體是否包含 receiverId
        if (!receiverId) {
            return res.status(400).json({ message: '發送請求失敗：缺少接收者 ID。' });
        }

        // 避免用戶向自己發送請求
        if (senderId === receiverId) {
            return res.status(400).json({ message: '你無法向自己發送好友請求。' });
        }

        // 檢查是否已經存在待處理的請求或他們已是好友
        const checkQuery = `
            SELECT * FROM friend_requests 
            WHERE 
                (sender_id = $1 AND recipient_id = $2)
                OR (sender_id = $2 AND recipient_id = $1 AND status = 'accepted')
        `;
        const checkResult = await pool.query(checkQuery, [senderId, receiverId]);
        
        if (checkResult.rows.length > 0) {
            // 根據不同情況返回不同的訊息
            const existingRequest = checkResult.rows[0];
            if (existingRequest.status === 'pending') {
                return res.status(409).json({ message: '好友請求已存在。' });
            } else if (existingRequest.status === 'accepted') {
                return res.status(409).json({ message: '你們已經是好友了。' });
            }
        }

        // 插入新的好友請求到資料庫
        const insertQuery = `
            INSERT INTO friend_requests (sender_id, recipient_id, status)
            VALUES ($1, $2, 'pending')
            RETURNING *;
        `;
        const { rows } = await pool.query(insertQuery, [senderId, receiverId]);
        const newRequest = rows[0];

        res.status(200).json({ 
            message: '好友請求發送成功。', 
            request: {
                _id: newRequest.id,
                sender: senderId,
                recipient: newRequest.recipient_id,
                status: newRequest.status,
            }
        });
    } catch (error) {
        console.error('發送好友請求失敗:', error);
        res.status(500).json({ message: '伺服器錯誤，無法發送好友請求。' });
    }
});

// 獲取所有待處理的好友請求
// GET /api/friends/requests
router.get('/requests', async (req, res) => {
    try {
        const currentUserId = req.user.id;

        const query = `
            SELECT 
                fr.id,
                fr.created_at,
                u.id AS sender_id,
                u.username AS sender_username,
                u.avatar AS sender_avatar
            FROM 
                friend_requests AS fr
            JOIN 
                users AS u ON fr.sender_id = u.id
            WHERE 
                fr.recipient_id = $1 AND fr.status = 'pending'
            ORDER BY
                fr.created_at DESC;
        `;

        const { rows } = await pool.query(query, [currentUserId]);

        // 將 SQL 查詢結果轉換成前端需要的格式
        const formattedRequests = rows.map(row => ({
            _id: row.id,
            createdAt: row.created_at,
            sender: {
                _id: row.sender_id,
                username: row.sender_username,
                avatar: row.sender_avatar,
            }
        }));

        res.status(200).json({ requests: formattedRequests });
    } catch (error) {
        console.error('獲取好友請求失敗:', error);
        res.status(500).json({ message: '伺服器錯誤，無法獲取好友請求。' });
    }
});

// 拒絕一個好友請求
// POST /api/friends/reject
// 請求主體 (body) 應包含 { requestId: '...' }
router.post('/reject', async (req, res) => {
    try {
        const { requestId } = req.body;
        const currentUserId = req.user.id; 

        if (!requestId) {
            return res.status(400).json({ message: '缺少好友請求 ID。' });
        }

        const checkQuery = `
            SELECT recipient_id FROM friend_requests WHERE id = $1;
        `;
        const checkResult = await pool.query(checkQuery, [requestId]);

        if (checkResult.rows.length === 0) {
            return res.status(404).json({ message: '找不到此好友請求。' });
        }
        
        if (checkResult.rows[0].recipient_id !== currentUserId) {
            return res.status(403).json({ message: '你無權拒絕此請求。' });
        }

        const updateQuery = `
            UPDATE friend_requests 
            SET status = 'rejected'
            WHERE id = $1 AND recipient_id = $2
            RETURNING id;
        `;
        await pool.query(updateQuery, [requestId, currentUserId]);

        res.status(200).json({ message: '好友請求已成功拒絕。', requestId });
    } catch (error) {
        console.error('拒絕好友請求失敗:', error);
        res.status(500).json({ message: '伺服器錯誤，無法拒絕好友請求。' });
    }
});

module.exports = router;
