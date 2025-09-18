const express = require('express');
const router = express.Router();
const { getNotifications, markNotificationsAsRead } = require('../controllers/notificationController');
const { protect } = require('../middlewares/authMiddleware');

// @route   GET /api/notifications
// @desc    Get all notifications for a user
// @access  Private
router.get('/', protect, getNotifications);

// @route   PUT /api/notifications/mark-read
// @desc    Mark notifications as read
// @access  Private
router.put('/mark-read', protect, markNotificationsAsRead);

// @route   PUT /api/notifications/mark-all-read
// @desc    Mark all notifications as read
// @access  Private
router.put('/mark-all-read', protect, markAllNotificationsAsRead);

module.exports = router;
