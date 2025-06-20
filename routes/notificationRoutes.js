const express = require('express');
const router = express.Router();
const { getUnreadCount } = require('../controllers/notificationController');
const protect = require('../middleware/authMiddleware')

router.get('/unread-count', protect, getUnreadCount);

module.exports = router;