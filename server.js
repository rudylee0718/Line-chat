// server.js
require('dotenv').config(); // 載入環境變數
const express = require('express');
const http = require('http'); // 引入 Node.js 內建的 http 模組
const { WebSocketServer } = require('ws'); // 引入 WebSocketServer
const bodyParser = require('body-parser');
const sequelize = require('./config/database');
const authRoutes = require('./routes/authRoutes');
const messageRoutes = require('./routes/messageRoutes'); // <-- 引入新路由
const groupRoutes = require('./routes/groupRoutes'); // <-- 引入新路由
const friendRequestRoutes = require('./routes/friendRequestRoutes');
const User = require('./models/user');
const Message = require('./models/message'); // <-- 引入 Message 模型
const Group = require('./models/group'); // 引入 Group 模型
const GroupMember = require('./models/groupMember'); // 引入 GroupMember 模型
const jwt = require('jsonwebtoken'); // 引入 jsonwebtoken 套件

const app = express();
const server = http.createServer(app); // 建立一個 HTTP 伺服器，Express 應用程式作為其處理程式

const wss = new WebSocketServer({ server }); // 將 WebSocket 伺服器附加到同一個 HTTP 伺服器上

// 中介軟體 (Middleware)
app.use(bodyParser.json());

// 掛載認證路由
app.use('/api/auth', authRoutes);
app.use('/api/messages', messageRoutes); // <-- 掛載新路由
app.use('/api/groups', groupRoutes); // <-- 掛載新路由
app.use('/api/friends', friendRequestRoutes);
// WebSocket 連線處理
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
    ws.close(1008, 'Token not provided'); // 關閉連線並提供錯誤碼
    console.log('Client connected without a token, connection closed.');
    return;
  }

  try {
    // 驗證 Token 並取得使用者 ID
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;

    // 將使用者 ID 儲存在 WebSocket 物件上，方便後續使用
    ws.userId = userId;
    console.log(`Client with userId ${userId} connected.`);

  } catch (err) {
    ws.close(1008, 'Invalid token'); // 如果 Token 無效，關閉連線
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

// 同步資料庫並啟動伺服器
const PORT = process.env.PORT || 3000; // <-- 監聽 Render 的 Port 或本地的 3000

// 同步資料庫並啟動伺服器
sequelize.sync({ force: false }) // 記得改回 false
  .then(() => {
    console.log('Database synchronized!');
    // *** 修正點在這裡！使用 server.listen() 來同時處理 HTTP 和 WebSocket 請求。 ***
    server.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('Failed to connect to the database:', err);
  });
  