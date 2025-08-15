// routes/authRoutes.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const userController = require('../controllers/userController'); // 引入 userController
const authMiddleware = require('../middleware/auth'); // 引入認證中介軟體

// 使用者認證相關路由
router.post('/register', authController.register);
router.post('/login', authController.login);

// 使用者相關路由（需要認證）
router.get('/users', authMiddleware, userController.getUsers); // <-- 新增的路由

module.exports = router;