const { Incident, Asset, Task, MeterReading, HospitalProfile } = require('../models/Hssm');
const Notification = require('../models/Notification');

// @desc    Get data for HSSM Provider Dashboard
// @route   GET /api/hssm-provider/dashboard
// @access  Private/HSSM-Provider
const getDashboardData = async (req, res) => {
  try {
    // KPI calculations
    const highPriorityIncidents = await Incident.countDocuments({ priority: 'High', status: { $ne: 'Closed' } });
    const overdueTasks = await Task.countDocuments({ dueDate: { $lt: new Date() }, status: { $ne: 'Completed' } });
    const totalAssets = await Asset.countDocuments();
    const activeIncidents = await Incident.countDocuments({ status: { $ne: 'Closed' } });

    // Additional analytics
    const totalIncidents = await Incident.countDocuments();
    const completedTasks = await Task.countDocuments({ status: 'Completed' });
    const totalTasks = await Task.countDocuments();
    const recentMeterReadings = await MeterReading.countDocuments({
      date: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Last 30 days
    });

    // Incident trends (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const incidentTrend = await Incident.aggregate([
      { $match: { date: { $gte: sevenDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
          count: { $sum: 1 }
        }
      },
      { $sort: { "_id": 1 } }
    ]);

    // Asset categories breakdown
    const assetCategories = await Asset.aggregate([
      { $group: { _id: "$category", count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Task priority breakdown
    const taskPriorities = await Task.aggregate([
      { $group: { _id: "$priority", count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    res.json({
      kpis: {
        highPriorityIncidents,
        overdueTasks,
        totalAssets,
        activeIncidents,
        totalIncidents,
        completedTasks,
        totalTasks,
        recentMeterReadings,
        taskCompletionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
      },
      analytics: {
        incidentTrend,
        assetCategories,
        taskPriorities,
      },
      recentIncidents: await Incident.find()
        .sort({ date: -1 })
        .limit(10)
        .select('title priority date department status'),
      upcomingTasks: await Task.find({
        dueDate: { $gte: new Date() },
        status: { $ne: 'Completed' }
      })
        .sort({ dueDate: 1 })
        .limit(10)
        .select('task assignedTo dueDate priority status'),
      recentAssets: await Asset.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .select('name category location serialNumber'),
    });
  } catch (error) {
    console.error('Error fetching HSSM Provider dashboard data:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get notifications for HSSM Provider
// @route   GET /api/hssm-provider/notifications
// @access  Private/HSSM-Provider
const getNotifications = async (req, res) => {
  try {
    const { id: userId } = req.user;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const notifications = await Notification.find({ recipient: userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('recipient', 'name email');

    const total = await Notification.countDocuments({ recipient: userId });
    const unreadCount = await Notification.countDocuments({ recipient: userId, read: false });

    res.json({
      notifications,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      },
      unreadCount
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Mark notification as read
// @route   PUT /api/hssm-provider/notifications/:id/read
// @access  Private/HSSM-Provider
const markNotificationAsRead = async (req, res) => {
  try {
    const { id: userId } = req.user;
    const { id: notificationId } = req.params;

    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, recipient: userId },
      { read: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    res.json(notification);
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Mark all notifications as read
// @route   PUT /api/hssm-provider/notifications/mark-all-read
// @access  Private/HSSM-Provider
const markAllNotificationsAsRead = async (req, res) => {
  try {
    const { id: userId } = req.user;

    await Notification.updateMany(
      { recipient: userId, read: false },
      { read: true }
    );

    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getDashboardData,
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
};
