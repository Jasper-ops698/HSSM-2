const express = require('express');
const router = express.Router();
const { getNotifications, markNotificationsAsRead, markAllNotificationsAsRead, deleteNotification, deleteAllNotifications } = require('../controllers/notificationController');
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

// @route   DELETE /api/notifications/:id
// @desc    Delete a single notification by ID (for the current user)
// @access  Private
router.delete('/:id', protect, deleteNotification);

// @route   DELETE /api/notifications
// @desc    Delete all notifications for the current user
// @access  Private
router.delete('/', protect, deleteAllNotifications);

// Route to register a device for push notifications
router.post('/register-device', authMiddleware, notificationController.registerDevice);

module.exports = router;
