// friendRequestController.js

const jwt = require('jsonwebtoken');

// 簡單的資料庫模擬 - 好友請求清單
let friendRequests = [];

// 這個函式會將路由邏輯附加到 Express 應用程式上
// 並接收 WebSocket 相關的變數
module.exports = function(app, wss, clients, users, authenticateToken) {
  
  /**
   * @api {post} /api/friends/request 發送好友請求
   * @apiHeader {String} Authorization JWT Token
   * @apiParam {Number} receiverId 接收者的使用者ID
   * @apiSuccess {String} message 請求發送成功訊息
   * @apiError (400) BadRequest 無法向自己發送請求
   * @apiError (404) NotFound 接收者使用者不存在
   * @apiError (409) Conflict 好友請求已發出
   */
  app.post('/api/friends/request', authenticateToken, (req, res) => {
    const senderId = req.user.id;
    const senderUsername = req.user.username;
    const { receiverId } = req.body;

    // 檢查接收者是否存在
    const receiverExists = users.some(user => user.id === receiverId);
    if (!receiverExists) {
      return res.status(404).send({ message: '接收者使用者不存在' });
    }

    // 檢查是否已發出過請求或已是好友
    const existingRequest = friendRequests.find(
      req => req.senderId === senderId && req.receiverId === receiverId
    );
    if (existingRequest) {
      return res.status(409).send({ message: '好友請求已發出' });
    }

    // 檢查是否向自己發送請求
    if (senderId === receiverId) {
      return res.status(400).send({ message: '無法向自己發送好友請求' });
    }

    // 建立新的請求並儲存 (模擬)
    const newRequest = { senderId, receiverId, status: 'pending', createdAt: new Date().toISOString() };
    friendRequests.push(newRequest);

    // 透過 WebSocket 發送通知
    const receiverWs = clients.get(receiverId);
    if (receiverWs && receiverWs.readyState === wss.OPEN) {
      receiverWs.send(JSON.stringify({
        type: 'friend_request',
        senderId: senderId,
        senderUsername: senderUsername,
      }));
      console.log(`好友請求通知已發送給 ${receiverId}`);
    }

    res.status(200).send({ message: '好友請求已發送' });
  });

  console.log("好友請求路由已載入");
};
