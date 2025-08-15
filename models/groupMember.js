// models/groupMember.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./user');
const Group = require('./group');

const GroupMember = sequelize.define('GroupMember', {
  isAdmin: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
});

// 建立多對多關聯
User.belongsToMany(Group, { through: GroupMember, foreignKey: 'userId' });
Group.belongsToMany(User, { through: GroupMember, foreignKey: 'groupId' });

module.exports = GroupMember;