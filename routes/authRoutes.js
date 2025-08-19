// routes/authRoutes.js

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/auth');

// 使用者認證相關路由
router.post('/register', authController.register);
router.post('/login', authController.login);

module.exports = router;