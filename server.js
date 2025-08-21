// server.js
require('dotenv').config();
const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const bodyParser = require('body-parser');
const sequelize = require('./config/database');
const { Pool } = require('pg');

// 引入所有路由和中介軟體
const authRoutes = require('./routes/authRoutes');
const messageRoutes = require('./routes/messageRoutes');
const groupRoutes = require('./routes/groupRoutes');
// 修正: 將中介軟體重新命名為 protectRoute，以避免與 authRoutes 混淆
const protectRoute = require('./middleware/auth'); 
const friendRequestRoutes = require('./routes/friendRequestRoutes');
const userRoutes = require('./routes/userRoutes');

const User = require('./models/user');
const Message = require('./models/message');
const Group = require('./models/group');
const GroupMember = require('./models/groupMember');
const jwt = require('jsonwebtoken');

// PostgreSQL 資料庫連線設定 (如果其他檔案也需要，可以在這裡集中設定)
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

const app = express();
const server = http.createServer(app);

const wss = new WebSocketServer({ server });

// --- 中介軟體 (Middleware) ---
app.use(bodyParser.json());

// 優先掛載不需要認證的路由
app.use('/api/auth', authRoutes);

// 修正: 將所有需要認證的路由群組化
// 並在每個群組前明確地使用 authMiddleware
// 這樣你的程式碼意圖更清晰
app.use('/api/messages', protectRoute, messageRoutes);
app.use('/api/groups', protectRoute, groupRoutes);
app.use('/api/friends', protectRoute, friendRequestRoutes);
app.use('/api/users', protectRoute, userRoutes);

// --- WebSocket 連線處理 ---
wss.on('connection', (ws, req) => {
    // 檢查請求 URL 是否為 /api/websocket
    if (req.url !== '/api/websocket') {
        ws.close(1000, 'Invalid WebSocket path');
        console.log('Client connected to an invalid WebSocket path, connection closed.');
        return;
    }

    // 從請求標頭中取得 token
    const token = req.headers['authorization']?.split(' ')[1];

    if (!token) {
        ws.close(1008, 'Token not provided');
        console.log('Client connected without a token, connection closed.');
        return;
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.userId;

        // 將使用者 ID 儲存在 WebSocket 物件上，方便後續使用
        ws.userId = userId;
        console.log(`Client with userId ${userId} connected.`);
    } catch (err) {
        ws.close(1008, 'Invalid token');
        console.error('Client connected with an invalid token, connection closed.');
        return;
    }

    ws.on('message', async (data) => {
        // 新增的檢查：如果訊息是 'ping'，則忽略它
        if (data.toString() === 'ping') {
            console.log('Received ping message, skipping processing.');
            return;
        }

        try {
            const message = JSON.parse(data);
            const senderId = ws.userId;

            // 檢查訊息是否有效
            if (!message.content || (!message.receiverId && !message.groupId)) {
                console.error('Received message without valid content, receiverId, or groupId, skipping save.');
                return;
            }

            let newMessage;
            let recipients = [];

            // 判斷是群組聊天還是一對一聊天
            if (message.groupId) {
                // 這是群組聊天
                const members = await GroupMember.findAll({ where: { groupId: message.groupId } });
                recipients = members.map(member => member.userId);

                newMessage = await Message.create({
                    content: message.content,
                    senderId: senderId,
                    groupId: message.groupId,
                });
            } else if (message.receiverId) {
                // 這是一對一聊天
                recipients = [senderId, message.receiverId];

                newMessage = await Message.create({
                    content: message.content,
                    senderId: senderId,
                    receiverId: message.receiverId,
                });
            }

            if (newMessage) {
                const messageWithDetails = {
                    id: newMessage.id,
                    content: newMessage.content,
                    senderId: newMessage.senderId,
                    receiverId: newMessage.receiverId,
                    groupId: newMessage.groupId,
                    createdAt: newMessage.createdAt,
                };

                const messageString = JSON.stringify(messageWithDetails);

                // 廣播給所有相關客戶端
                wss.clients.forEach(client => {
                    if (client.readyState === ws.OPEN && recipients.includes(client.userId)) {
                        client.send(messageString);
                    }
                });
                console.log('Message saved and sent to specific clients:', messageWithDetails);
            }
        } catch (error) {
            console.error('Failed to save or process message:', error);
        }
    });

    ws.on('close', () => {
        console.log(`Client with userId ${ws.userId} disconnected.`);
    });
});

// --- 同步資料庫並啟動伺服器 ---
const PORT = process.env.PORT || 3000;

sequelize.sync({ force: false })
    .then(() => {
        console.log('Database synchronized!');
        server.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        });
    })
    .catch(err => {
        console.error('Failed to connect to the database:', err);
    });
