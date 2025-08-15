// routes/groupRoutes.js
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const groupController = require('../controllers/groupController');

// 所有群組相關路由都需要認證
router.post('/', authMiddleware, groupController.createGroup);
router.get('/', authMiddleware, groupController.getGroups);
router.get('/:groupId/members', authMiddleware, groupController.getGroupMembers);
router.post('/:groupId/members', authMiddleware, groupController.addMember); // <-- 新增的路由


module.exports = router;