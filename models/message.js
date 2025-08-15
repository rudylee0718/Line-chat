// models/message.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./user');
const Group = require('./group'); // 引入 Group 模型

const Message = sequelize.define('Message', {
  content: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
});

// 一條訊息屬於一個發送者
Message.belongsTo(User, {
  foreignKey: 'senderId',
  as: 'sender',
});

// 一條訊息可以有一個收件者（一對一聊天）
Message.belongsTo(User, {
  foreignKey: 'receiverId',
  as: 'receiver',
});

// 一條訊息可以屬於一個群組（群組聊天）
Message.belongsTo(Group, {
  foreignKey: 'groupId',
  as: 'group',
});

// 使用者與訊息的關聯
User.hasMany(Message, {
  foreignKey: 'senderId',
  as: 'sentMessages',
});
User.hasMany(Message, {
  foreignKey: 'receiverId',
  as: 'receivedMessages',
});

// 群組與訊息的關聯
Group.hasMany(Message, {
  foreignKey: 'groupId',
  as: 'groupMessages',
});

module.exports = Message;