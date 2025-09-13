const express = require('express');
const router = express.Router();
const {
  getDashboardData,
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead
} = require('../controllers/hssmProviderController');
const { protect } = require('../middlewares/authMiddleware');
const verifyRole = require('../middlewares/verifyRole');

// @route   GET /api/hssm-provider/dashboard
// @desc    Get data for HSSM Provider dashboard
// @access  Private (HSSM-Provider)
router.get('/dashboard', protect, verifyRole(['HSSM-provider']), getDashboardData);

// @route   GET /api/hssm-provider/notifications
// @desc    Get notifications for HSSM Provider
// @access  Private (HSSM-Provider)
router.get('/notifications', protect, verifyRole(['HSSM-provider']), getNotifications);

// @route   PUT /api/hssm-provider/notifications/:id/read
// @desc    Mark notification as read
// @access  Private (HSSM-Provider)
router.put('/notifications/:id/read', protect, verifyRole(['HSSM-provider']), markNotificationAsRead);

// @route   PUT /api/hssm-provider/notifications/mark-all-read
// @desc    Mark all notifications as read
// @access  Private (HSSM-Provider)
router.put('/notifications/mark-all-read', protect, verifyRole(['HSSM-provider']), markAllNotificationsAsRead);

module.exports = router;
