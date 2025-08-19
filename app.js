// WebSocket 伺服器
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// 儲存 WebSocket 連線的 Map
// key: userId, value: WebSocket 連線
const clients = new Map();

wss.on('connection', (ws, req) => {
  // 驗證 JWT token 以獲取用戶ID
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    jwt.verify(token, SECRET_KEY, (err, user) => {
      if (!err && user) {
        const userId = user.id;
        console.log(`用戶 ${userId} 已連線到 WebSocket`);
        clients.set(userId, ws);

        ws.on('message', (message) => {
          try {
            const data = JSON.parse(message);
            // 處理聊天訊息
            if (data.receiverId && data.content) {
              const newMessage = {
                senderId: userId,
                receiverId: data.receiverId,
                content: data.content,
                createdAt: new Date().toISOString(),
                id: messages.length + 1,
              };
              messages.push(newMessage);
              console.log(`收到來自 ${userId} 的訊息給 ${data.receiverId}: ${data.content}`);
              
              // 找到接收者的連線並發送訊息
              const receiverWs = clients.get(data.receiverId);
              if (receiverWs && receiverWs.readyState === WebSocket.OPEN) {
                receiverWs.send(JSON.stringify(newMessage));
                console.log(`訊息已發送給 ${data.receiverId}`);
              }
              // 同時發送給自己，以確保聊天室同步
              const senderWs = clients.get(userId);
              if (senderWs && senderWs.readyState === WebSocket.OPEN) {
                senderWs.send(JSON.stringify(newMessage));
              }
            } else if (message.toString() === 'ping') {
              ws.send('pong');
            }

          } catch (e) {
            console.error('解析 WebSocket 訊息錯誤:', e);
          }
        });

        ws.on('close', () => {
          clients.delete(userId);
          console.log(`用戶 ${userId} 已中斷連線`);
        });

        ws.on('error', (error) => {
          console.error(`WebSocket 錯誤:`, error);
        });

      } else {
        ws.close(1008, '認證失敗');
      }
    });
  } else {
    ws.close(1008, '未提供認證');
  }
});

// 登入 API
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username);
  if (!user) {
    return res.status(401).send({ message: '無效的用戶名或密碼' });
  }

  const passwordIsValid = bcrypt.compareSync(password, user.passwordHash);
  if (!passwordIsValid) {
    return res.status(401).send({ message: '無效的用戶名或密碼' });
  }

  const token = jwt.sign({ id: user.id, username: user.username }, SECRET_KEY, {
    expiresIn: 86400, // 24小時
  });

  res.status(200).send({
    id: user.id,
    username: user.username,
    token: token,
  });
});

// 獲取所有用戶列表 API (用於示範)
app.get('/api/users', authenticateToken, (req, res) => {
  const allUsers = users.map(u => ({ id: u.id, username: u.username }));
  res.status(200).send(allUsers);
});

// 獲取特定聊天對象的歷史訊息
app.get('/api/messages/:receiverId', authenticateToken, (req, res) => {
  const myId = req.user.id;
  const receiverId = parseInt(req.params.receiverId);

  const relevantMessages = messages.filter(
    msg => (msg.senderId === myId && msg.receiverId === receiverId) ||
           (msg.senderId === receiverId && msg.receiverId === myId)
  );

  res.status(200).send(relevantMessages);
});

// 呼叫 friendRequestController 來設定其路由
friendRequestController(app, wss, clients, users, authenticateToken);

// 啟動伺服器
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`伺服器正在 port ${PORT} 上運行`);
});
