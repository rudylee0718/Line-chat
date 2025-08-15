// controllers/messageController.js
const { Op } = require('sequelize'); // 引入 Sequelize 的 Op 運算子
const Message = require('../models/message');
const User = require('../models/user');

exports.getMessages = async (req, res) => {
  try {
    const userId = req.userData.userId; // 從 JWT 認證中介軟體中取得使用者 ID

    const messages = await Message.findAll({
      where: {
        [Op.or]: [ // 使用 Op.or 運算子來查詢
          { senderId: userId },
          { receiverId: userId }
        ]
      },
      include: [
        { model: User, as: 'sender', attributes: ['id', 'username'] },
        { model: User, as: 'receiver', attributes: ['id', 'username'] }
      ],
      order: [['createdAt', 'ASC']] // 按照發送時間升序排列
    });

    res.status(200).json(messages);
  } catch (error) {
    console.error('Failed to get messages:', error);
    res.status(500).json({ message: '獲取訊息失敗。' });
  }
};

// 獲取與特定使用者的一對一對話紀錄
exports.getConversation = async (req, res) => {
  try {
    const currentUserId = req.userData.userId; // 來自 JWT 的當前使用者 ID
    const receiverId = req.params.receiverId; // 從 URL 參數中取得收件者 ID

    const conversation = await Message.findAll({
      where: {
        [Op.or]: [
          { senderId: currentUserId, receiverId: receiverId },
          { senderId: receiverId, receiverId: currentUserId },
        ],
      },
      include: [
        { model: User, as: 'sender', attributes: ['id', 'username'] },
        { model: User, as: 'receiver', attributes: ['id', 'username'] },
      ],
      order: [['createdAt', 'ASC']],
    });

    res.status(200).json(conversation);
  } catch (error) {
    console.error('Failed to get conversation:', error);
    res.status(500).json({ message: '獲取對話紀錄失敗。' });
  }
};