const express = require('express');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const WebSocket = require('ws');
const http = require('http');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(bodyParser.json());

// 簡單的資料庫模擬
const users = [
    { id: 1, username: 'user1', passwordHash: bcrypt.hashSync('password123', 10) },
    { id: 2, username: 'user2', passwordHash: bcrypt.hashSync('password456', 10) },
    { id: 3, username: 'user3', passwordHash: bcrypt.hashSync('password789', 10) },
];

const friends = [
    { userId: 1, friendId: 2, status: 'accepted' },
    { userId: 2, friendId: 1, status: 'accepted' },
    { userId: 1, friendId: 3, status: 'pending' },
];

const messages = [
    { id: 1, senderId: 1, receiverId: 2, content: '你好！', createdAt: new Date().toISOString(), read: false },
    { id: 2, senderId: 2, receiverId: 1, content: '嗨，你好！', createdAt: new Date().toISOString(), read: false },
];

const SECRET_KEY = 'your_secret_key';

// 驗證 JWT Token 的中間件
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.sendStatus(401);

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// WebSocket 狀態管理
const clients = new Map();

wss.on('connection', (ws, req) => {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) {
        ws.close(1008, '未提供認證令牌');
        return;
    }

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) {
            ws.close(1008, '無效的認證令牌');
            return;
        }

        const userId = user.id;
        clients.set(userId, ws);
        console.log(`用戶 ${userId} 已連線`);

        ws.on('message', (message) => {
            const data = JSON.parse(message);
            const { receiverId, content } = data;

            // 儲存訊息到資料庫（模擬）
            const newMessage = {
                id: messages.length + 1,
                senderId: userId,
                receiverId,
                content,
                createdAt: new Date().toISOString(),
                read: false, // 新增 'read' 屬性
            };
            messages.push(newMessage);

            // 找到接收者客戶端
            const receiverClient = clients.get(receiverId);

            // 將訊息傳送給發送者和接收者
            const messageToSend = {
                senderId: userId,
                senderUsername: users.find(u => u.id === userId).username,
                receiverId,
                content,
                createdAt: newMessage.createdAt,
                id: newMessage.id,
                read: false, // 初始未讀
            };
            
            // 傳送給接收者
            if (receiverClient && receiverClient.readyState === WebSocket.OPEN) {
                receiverClient.send(JSON.stringify(messageToSend));
            }

            // 傳送給發送者，確保 UI 同步
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify(messageToSend));
            }
        });

        ws.on('close', () => {
            clients.delete(userId);
            console.log(`用戶 ${userId} 已離線`);
        });

        ws.on('error', (err) => {
            console.error(`用戶 ${userId} 的 WebSocket 錯誤: ${err}`);
        });
    });
});

// API 端點：登入
app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    const user = users.find(u => u.username === username);

    if (!user) {
        return res.status(401).json({ message: '用戶名或密碼錯誤' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
        return res.status(401).json({ message: '用戶名或密碼錯誤' });
    }

    const token = jwt.sign({ id: user.id, username: user.username }, SECRET_KEY, { expiresIn: '1h' });
    res.json({ token, id: user.id, username: user.username });
});

// API 端點：獲取所有用戶
app.get('/api/users', authenticateToken, (req, res) => {
    res.json(users.map(u => ({ id: u.id, username: u.username })));
});

// API 端點：發送好友請求
app.post('/api/friends/request', authenticateToken, (req, res) => {
    const { receiverId } = req.body;
    const senderId = req.user.id;

    if (senderId === receiverId) {
        return res.status(400).json({ message: '無法向自己發送好友請求' });
    }

    const existingRequest = friends.some(
        f => (f.userId === senderId && f.friendId === receiverId) || (f.userId === receiverId && f.friendId === senderId)
    );

    if (existingRequest) {
        return res.status(409).json({ message: '好友請求已存在或已是好友' });
    }

    const requestId = friends.length + 1;
    friends.push({ userId: senderId, friendId: receiverId, status: 'pending', requestId });

    // 透過 WebSocket 通知接收者
    const receiverClient = clients.get(receiverId);
    if (receiverClient && receiverClient.readyState === WebSocket.OPEN) {
        receiverClient.send(JSON.stringify({
            type: 'friend_request',
            senderId,
            senderUsername: req.user.username,
            requestId,
        }));
    }

    res.json({ message: '好友請求已發送' });
});

// API 端點：接受好友請求
app.post('/api/friends/accept', authenticateToken, (req, res) => {
    const { requestId } = req.body;
    const request = friends.find(f => f.requestId === requestId && f.friendId === req.user.id && f.status === 'pending');

    if (!request) {
        return res.status(404).json({ message: '好友請求不存在或已過期' });
    }

    request.status = 'accepted';
    
    // 建立雙向好友關係
    friends.push({ userId: request.friendId, friendId: request.userId, status: 'accepted' });

    // 透過 WebSocket 通知發送者
    const senderClient = clients.get(request.userId);
    if (senderClient && senderClient.readyState === WebSocket.OPEN) {
        senderClient.send(JSON.stringify({
            type: 'friend_request_accepted',
            senderId: req.user.id,
            senderUsername: req.user.username,
        }));
    }

    res.json({ message: '已接受好友請求' });
});

// API 端點：拒絕好友請求
app.post('/api/friends/reject', authenticateToken, (req, res) => {
    const { requestId } = req.body;
    const requestIndex = friends.findIndex(f => f.requestId === requestId && f.friendId === req.user.id && f.status === 'pending');
    
    if (requestIndex === -1) {
        return res.status(404).json({ message: '好友請求不存在或已過期' });
    }

    const request = friends[requestIndex];
    friends.splice(requestIndex, 1);
    
    // 透過 WebSocket 通知發送者
    const senderClient = clients.get(request.userId);
    if (senderClient && senderClient.readyState === WebSocket.OPEN) {
        senderClient.send(JSON.stringify({
            type: 'friend_request_rejected',
            senderId: req.user.id,
            senderUsername: req.user.username,
        }));
    }

    res.json({ message: '已拒絕好友請求' });
});

// API 端點：獲取好友列表
app.get('/api/friends', authenticateToken, (req, res) => {
    const myFriends = friends
        .filter(f => f.userId === req.user.id && f.status === 'accepted')
        .map(f => {
            const friend = users.find(u => u.id === f.friendId);
            return { id: friend.id, username: friend.username };
        });
    res.json(myFriends);
});

// API 端點：獲取歷史訊息
app.get('/api/messages/:friendId', authenticateToken, (req, res) => {
    const { friendId } = req.params;
    const userId = req.user.id;
    const friendIdInt = parseInt(friendId);

    // 篩選出與該好友的聊天記錄
    const chatHistory = messages
        .filter(m => (m.senderId === userId && m.receiverId === friendIdInt) || (m.senderId === friendIdInt && m.receiverId === userId))
        .map(m => {
            const sender = users.find(u => u.id === m.senderId);
            return {
                id: m.id,
                senderId: m.senderId,
                senderUsername: sender.username,
                receiverId: m.receiverId,
                content: m.content,
                createdAt: m.createdAt,
                read: m.read, // 包含 'read' 屬性
            };
        });
    res.json(chatHistory);
});

// 新增 API 端點：標記訊息為已讀
app.post('/api/messages/read/:friendId', authenticateToken, (req, res) => {
    const { friendId } = req.params;
    const userId = req.user.id;
    const friendIdInt = parseInt(friendId);

    const readMessageIds = [];
    messages.forEach(m => {
        // 找出發送給我的、來自該好友且未讀的訊息
        if (m.senderId === friendIdInt && m.receiverId === userId && !m.read) {
            m.read = true;
            readMessageIds.push(m.id);
        }
    });

    // 透過 WebSocket 通知發送者
    const senderClient = clients.get(friendIdInt);
    if (senderClient && senderClient.readyState === WebSocket.OPEN) {
        senderClient.send(JSON.stringify({
            type: 'read_receipt',
            readMessageIds,
            readerId: userId
        }));
    }

    res.status(200).json({ message: '訊息已讀標記成功' });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`伺服器正在 http://localhost:${PORT} 上運行`);
});
