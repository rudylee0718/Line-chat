// friendRequestController.js

const jwt = require('jsonwebtoken');

// 簡單的資料庫模擬 - 好友請求清單
let friendRequests = [];

// 這個函式會將路由邏輯附加到 Express 應用程式上
// 並接收 WebSocket 相關的變數
module.exports = function(app, wss, clients, users, friends, authenticateToken) {
  
  /**
   * @api {post} /api/friends/request 發送好友請求
   * @apiHeader {String} Authorization JWT Token
   * @apiParam {Number} receiverId 接收者的使用者ID
   * @apiSuccess {String} message 請求發送成功訊息
   * @apiError (400) BadRequest 無法向自己發送請求
   * @apiError (404) NotFound 接收者使用者不存在
   * @apiError (409) Conflict 好友請求已發出或已是好友
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

    // 檢查是否已是好友
    const alreadyFriends = friends.some(
      f => (f.userId === senderId && f.friendId === receiverId) ||
           (f.userId === receiverId && f.friendId === senderId)
    );
    if (alreadyFriends) {
      return res.status(409).send({ message: '你們已經是好友了' });
    }

    // 檢查是否已發出過請求
    const existingRequest = friendRequests.find(
      req => (req.senderId === senderId && req.receiverId === receiverId) ||
             (req.senderId === receiverId && req.receiverId === senderId)
    );
    if (existingRequest) {
      return res.status(409).send({ message: '好友請求已發出或待處理' });
    }

    // 檢查是否向自己發送請求
    if (senderId === receiverId) {
      return res.status(400).send({ message: '無法向自己發送好友請求' });
    }

    // 建立新的請求並儲存 (模擬)
    const newRequestId = friendRequests.length + 1;
    const newRequest = {
      id: newRequestId,
      senderId,
      senderUsername,
      receiverId,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    friendRequests.push(newRequest);

    // 透過 WebSocket 發送通知
    const receiverWs = clients.get(receiverId);
    if (receiverWs && receiverWs.readyState === wss.OPEN) {
      receiverWs.send(JSON.stringify({
        type: 'friend_request',
        requestId: newRequest.id, // 新增請求ID
        senderId: senderId,
        senderUsername: senderUsername,
      }));
      console.log(`好友請求通知已發送給 ${receiverId}`);
    }

    res.status(200).send({ message: '好友請求已發送' });
  });

  /**
   * @api {post} /api/friends/accept 接受好友請求
   * @apiHeader {String} Authorization JWT Token
   * @apiParam {Number} requestId 請求ID
   * @apiSuccess {String} message 成功接受請求訊息
   * @apiError (404) NotFound 請求不存在
   * @apiError (403) Forbidden 無權接受此請求
   */
  app.post('/api/friends/accept', authenticateToken, (req, res) => {
    const myId = req.user.id;
    const myUsername = req.user.username;
    const { requestId } = req.body;

    // 尋找請求
    const requestIndex = friendRequests.findIndex(r => r.id === requestId);
    if (requestIndex === -1) {
      return res.status(404).send({ message: '請求不存在' });
    }
    const request = friendRequests[requestIndex];

    // 檢查是否有權限
    if (request.receiverId !== myId) {
      return res.status(403).send({ message: '無權接受此請求' });
    }

    // 將請求狀態改為 'accepted'
    friendRequests[requestIndex].status = 'accepted';

    // 在模擬的好友列表中新增彼此
    friends.push({ userId: request.senderId, friendId: myId });
    friends.push({ userId: myId, friendId: request.senderId });

    // 透過 WebSocket 通知發送者請求已被接受
    const senderWs = clients.get(request.senderId);
    if (senderWs && senderWs.readyState === wss.OPEN) {
      senderWs.send(JSON.stringify({
        type: 'friend_request_accepted',
        senderUsername: myUsername,
        senderId: myId,
      }));
      console.log(`好友請求接受通知已發送給 ${request.senderId}`);
    }

    res.status(200).send({ message: '已接受好友請求' });
  });

  /**
   * @api {post} /api/friends/reject 拒絕好友請求
   * @apiHeader {String} Authorization JWT Token
   * @apiParam {Number} requestId 請求ID
   * @apiSuccess {String} message 成功拒絕請求訊息
   * @apiError (404) NotFound 請求不存在
   * @apiError (403) Forbidden 無權拒絕此請求
   */
  app.post('/api/friends/reject', authenticateToken, (req, res) => {
    const myId = req.user.id;
    const myUsername = req.user.username;
    const { requestId } = req.body;

    // 尋找請求
    const requestIndex = friendRequests.findIndex(r => r.id === requestId);
    if (requestIndex === -1) {
      return res.status(404).send({ message: '請求不存在' });
    }
    const request = friendRequests[requestIndex];

    // 檢查是否有權限
    if (request.receiverId !== myId) {
      return res.status(403).send({ message: '無權拒絕此請求' });
    }

    // 從列表中移除請求 (模擬)
    friendRequests.splice(requestIndex, 1);

    // 透過 WebSocket 通知發送者請求已被拒絕
    const senderWs = clients.get(request.senderId);
    if (senderWs && senderWs.readyState === wss.OPEN) {
      senderWs.send(JSON.stringify({
        type: 'friend_request_rejected',
        senderUsername: myUsername,
        senderId: myId,
      }));
      console.log(`好友請求拒絕通知已發送給 ${request.senderId}`);
    }

    res.status(200).send({ message: '已拒絕好友請求' });
  });

  console.log("好友請求路由已載入");
};