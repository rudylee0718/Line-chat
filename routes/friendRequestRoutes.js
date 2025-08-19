// friendRequestRoutes.js
const express = require('express');
const router = express.Router();
const { Pool } = require('pg'); // 從 'pg' 模組引入 Pool

// --- PostgreSQL 資料庫連線設定 ---
// 你應該將這些設定放在一個環境變數檔案 (例如 .env) 中
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

// --- 資料表結構 (SQL) ---
// 你需要在你的資料庫中執行這些 SQL 指令來創建資料表
/*
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(255) NOT NULL UNIQUE,
    avatar VARCHAR(255),
    -- 其他用戶欄位...
);

CREATE TABLE friend_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL REFERENCES users(id),
    recipient_id UUID NOT NULL REFERENCES users(id),
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    -- 確保用戶不能重複發送請求
    UNIQUE (sender_id, recipient_id)
);
*/

// --- 路由 ---
// 獲取所有待處理的好友請求
// GET /api/friends/requests
router.get('/requests', async (req, res) => {
    try {
        // 這裡需要根據你的認證系統來獲取當前用戶的 ID
        const currentUserId = req.user.id; 

        // 使用 SQL JOIN 查詢來獲取發送者的詳細資訊
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

        if (rows.length === 0) {
            return res.status(200).json({ message: '目前沒有待處理的好友請求。', requests: [] });
        }

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

        // 檢查該請求是否存在且當前用戶是接收者
        const checkQuery = `
            SELECT recipient_id FROM friend_requests WHERE id = $1;
        `;
        const checkResult = await pool.query(checkQuery, [requestId]);

        if (checkResult.rows.length === 0) {
            return res.status(404).json({ message: '找不到此好友請求。' });
        }
        
        // 確保只有請求的接收者可以拒絕
        if (checkResult.rows[0].recipient_id !== currentUserId) {
            return res.status(403).json({ message: '你無權拒絕此請求。' });
        }

        // 將狀態更新為 'rejected'
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
