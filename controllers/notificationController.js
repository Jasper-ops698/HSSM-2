const Notification = require('../models/Notification');
const { NotificationHubsClient } = require("@azure/notification-hubs");
const { notificationHub } = require("../config/config");

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

// Delete a single notification by ID (for the current user)
const deleteNotification = async (req, res) => {
  try {
    const notification = await Notification.findOneAndDelete({ _id: req.params.id, recipient: req.user._id });
    if (!notification) {
      return res.status(404).json({ msg: 'Notification not found.' });
    }
    res.json({ msg: 'Notification deleted.' });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};

// Delete all notifications for the current user
const deleteAllNotifications = async (req, res) => {
  try {
    await Notification.deleteMany({ recipient: req.user._id });
    res.json({ msg: 'All notifications deleted.' });
  } catch (error) {
    console.error('Error deleting all notifications:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};

exports.registerDevice = async (req, res) => {
  const { token, userId, platform } = req.body; // platform can be 'fcm', 'apns', etc.

  if (!token || !userId || !platform) {
    return res.status(400).json({ message: "Token, userId, and platform are required." });
  }

  try {
    const client = new NotificationHubsClient(notificationHub.connectionString, notificationHub.hubName);

    const installationId = `${userId}-${token}`;
    const installation = {
      installationId: installationId,
      pushChannel: token,
      platform: platform,
      tags: [`user_${userId}`],
    };

    await client.createOrUpdateInstallation(installation);

    res.status(200).json({ message: "Device registered successfully." });
  } catch (error) {
    console.error("Error registering device:", error);
    res.status(500).json({ message: "Failed to register device." });
  }
};

module.exports = {
  getNotifications,
  markNotificationsAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  deleteAllNotifications,
};
