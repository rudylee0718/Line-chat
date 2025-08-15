// controllers/groupController.js
const Group = require('../models/group');
const User = require('../models/user');
const GroupMember = require('../models/groupMember');

// 建立群組
exports.createGroup = async (req, res) => {
  try {
    const { name } = req.body;
    const userId = req.userData.userId; // 來自 JWT 的使用者 ID

    const newGroup = await Group.create({ name });
    await GroupMember.create({
      userId,
      groupId: newGroup.id,
      isAdmin: true,
    });

    res.status(201).json({ message: '群組建立成功', group: newGroup });
  } catch (error) {
    console.error('Failed to create group:', error);
    res.status(500).json({ message: '群組建立失敗' });
  }
};

// 獲取使用者所屬的所有群組
exports.getGroups = async (req, res) => {
  try {
    const userId = req.userData.userId;
    const groups = await Group.findAll({
      include: {
        model: User,
        through: { where: { userId } },
        attributes: ['id', 'username'],
      },
    });

    res.status(200).json(groups);
  } catch (error) {
    console.error('Failed to get groups:', error);
    res.status(500).json({ message: '獲取群組列表失敗' });
  }
};

// 獲取特定群組的所有成員
exports.getGroupMembers = async (req, res) => {
  try {
    const groupId = req.params.groupId;
    const group = await Group.findByPk(groupId, {
      include: [
        {
          model: User,
          through: { attributes: ['isAdmin'] },
          attributes: ['id', 'username'],
        },
      ],
    });

    if (!group) {
      return res.status(404).json({ message: '找不到群組' });
    }

    res.status(200).json(group.Users);
  } catch (error) {
    console.error('Failed to get group members:', error);
    res.status(500).json({ message: '獲取群組成員失敗' });
  }
};

// 將使用者加入群組
exports.addMember = async (req, res) => {
  try {
    const groupId = req.params.groupId;
    const { userId } = req.body;

    const group = await Group.findByPk(groupId);
    const user = await User.findByPk(userId);

    if (!group) {
      return res.status(404).json({ message: '找不到群組' });
    }
    if (!user) {
      return res.status(404).json({ message: '找不到使用者' });
    }

    const member = await GroupMember.findOne({
      where: { userId, groupId },
    });

    if (member) {
      return res.status(409).json({ message: '使用者已是群組成員' });
    }

    await GroupMember.create({ userId, groupId });

    res.status(201).json({ message: '使用者已成功加入群組' });
  } catch (error) {
    console.error('Failed to add member to group:', error);
    res.status(500).json({ message: '新增群組成員失敗' });
  }
};