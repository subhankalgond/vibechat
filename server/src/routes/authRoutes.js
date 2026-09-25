const express = require('express');
const authController = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiters');

const router = express.Router();

router.post('/register', authLimiter, authController.register);
router.post('/login', authLimiter, authController.login);
router.get('/me', requireAuth, authController.me);
router.post('/logout', requireAuth, authController.logout);

module.exports = router;
