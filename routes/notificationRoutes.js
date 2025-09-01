const express = require('express');
const router = express.Router();
const { getNotifications, markNotificationsAsRead } = require('../controllers/notificationController');
const authMiddleware = require('../middlewares/authMiddleware');

// @route   GET /api/notifications
// @desc    Get all notifications for a user
// @access  Private
router.get('/', authMiddleware, getNotifications);

// @route   PUT /api/notifications/mark-read
// @desc    Mark notifications as read
// @access  Private
router.put('/mark-read', authMiddleware, markNotificationsAsRead);

module.exports = router;
