const { Incident, Asset, Task } = require('../models/Hssm');

// @desc    Get data for HSSM Provider Dashboard
// @route   GET /api/hssm-provider/dashboard
// @access  Private/HSSM-Provider
const getDashboardData = async (req, res) => {
  try {
    // In a multi-tenant app, you'd filter by user or facility ID.
    // For now, we'll fetch global stats.
    const highPriorityIncidents = await Incident.countDocuments({ priority: 'High', status: { $ne: 'Closed' } });
    const overdueTasks = await Task.countDocuments({ dueDate: { $lt: new Date() }, status: { $ne: 'Completed' } });
    const totalAssets = await Asset.countDocuments();
    const activeIncidents = await Incident.countDocuments({ status: { $ne: 'Closed' } });

    res.json({
      kpis: {
        highPriorityIncidents,
        overdueTasks,
        totalAssets,
        activeIncidents,
      },
      // We can add recent activity feeds later
      recentIncidents: await Incident.find().sort({ date: -1 }).limit(5),
      upcomingTasks: await Task.find({ dueDate: { $gte: new Date() } }).sort({ dueDate: 1 }).limit(5),
    });
  } catch (error) {
    console.error('Error fetching HSSM Provider dashboard data:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getDashboardData,
};
