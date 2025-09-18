const Notification = require('../models/Notification');

const getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ recipient: req.user.id }).sort({ createdAt: -1 });
    res.json(notifications);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};

const markNotificationsAsRead = async (req, res) => {
  const { notificationIds } = req.body;

  if (!notificationIds || !Array.isArray(notificationIds) || notificationIds.length === 0) {
    return res.status(400).json({ msg: 'Notification IDs are required.' });
  }

  try {
    await Notification.updateMany(
      { _id: { $in: notificationIds }, recipient: req.user._id },
      { $set: { read: true } }
    );
    res.json({ msg: 'Notifications marked as read.' });
  } catch (error) {
    console.error('Error marking notifications as read:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};

const markAllNotificationsAsRead = async (req, res) => {
  try {
    const result = await Notification.updateMany(
      { recipient: req.user._id, read: false },
      { $set: { read: true } }
    );

    if (result.nModified === 0) {
      return res.status(200).json({ msg: 'No unread notifications to mark as read.' });
    }

    res.json({ msg: 'All notifications marked as read.' });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};

module.exports = {
  getNotifications,
  markNotificationsAsRead,
  markAllNotificationsAsRead,
};
