// routes/userRoutes.js

const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController'); 
const authMiddleware = require('../middleware/auth'); 

/**
 * @route   GET /api/users
 * @desc    獲取所有使用者列表
 * @access  Private
 */
router.get('/', authMiddleware, userController.getUsers);

/**
 * @route   GET /api/users/search
 * @desc    根據使用者名稱搜尋使用者
 * @access  Private
 */
router.get('/search', authMiddleware, userController.searchUsers);

module.exports = router;