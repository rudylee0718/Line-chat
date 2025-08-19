// controllers/friendRequestController.js
const { User, FriendRequest } = require('../models');
const { getWss } = require('../websockets'); // 引入 WebSocket Server 實例

// 發送好友請求
const sendFriendRequest = async (req, res) => {
  const senderId = req.user.id;
  const { receiverId } = req.body;

  if (senderId === receiverId) {
    return res.status(400).json({ message: '無法向自己發送好友請求' });
  }

  try {
    const existingRequest = await FriendRequest.findOne({
      where: {
        senderId: senderId,
        receiverId: receiverId,
      },
    });

    if (existingRequest) {
      return res.status(400).json({ message: '好友請求已發送' });
    }

    const newRequest = await FriendRequest.create({
      senderId: senderId,
      receiverId: receiverId,
      status: 'pending',
    });

    const sender = await User.findByPk(senderId, {
      attributes: ['id', 'username'],
    });

    // 通過 WebSocket 向接收者發送即時通知
    const wss = getWss();
    if (wss) {
      wss.clients.forEach(client => {
        if (client.readyState === client.OPEN && client.userId === receiverId) {
          console.log(`Sending real-time friend request notification to user ${receiverId}`);
          client.send(JSON.stringify({
            type: 'friendRequest',
            senderId: sender.id,
            senderUsername: sender.username,
          }));
        }
      });
    }

    return res.status(200).json({ message: '好友請求已發送' });
  } catch (error) {
    console.error('Failed to send friend request:', error);
    return res.status(500).json({ message: '伺服器錯誤', error: error.message });
  }
};

// 接受好友請求
const acceptFriendRequest = async (req, res) => {
  const receiverId = req.user.id;
  const { requesterId } = req.body;

  try {
    const request = await FriendRequest.findOne({
      where: {
        senderId: requesterId,
        receiverId: receiverId,
        status: 'pending',
      },
    });

    if (!request) {
      return res.status(404).json({ message: '找不到待處理的好友請求' });
    }

    // 更新請求狀態
    request.status = 'accepted';
    await request.save();

    return res.status(200).json({ message: '好友請求已接受' });
  } catch (error) {
    console.error('Failed to accept friend request:', error);
    return res.status(500).json({ message: '伺服器錯誤', error: error.message });
  }
};

// 獲取好友請求列表
const getFriendRequests = async (req, res) => {
  const userId = req.user.id;

  try {
    const requests = await FriendRequest.findAll({
      where: {
        receiverId: userId,
        status: 'pending',
      },
      include: [{ model: User, as: 'sender', attributes: ['id', 'username'] }],
    });

    const formattedRequests = requests.map(req => ({
      requesterId: req.sender.id,
      requesterUsername: req.sender.username,
      createdAt: req.createdAt,
    }));

    return res.status(200).json(formattedRequests);
  } catch (error) {
    console.error('Failed to get friend requests:', error);
    return res.status(500).json({ message: '伺服器錯誤', error: error.message });
  }
};


module.exports = {
  sendFriendRequest,
  acceptFriendRequest,
  getFriendRequests,
};
