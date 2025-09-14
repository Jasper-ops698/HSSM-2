const { Incident, Asset, Task } = require('../models/Hssm');
const mongoose = require('mongoose');
const asyncHandler = require('express-async-handler');

// @desc    Get HSSM dashboard data
// @route   GET /api/hssm/dashboard
// @access  Private/HSSM-provider
const getDashboardData = asyncHandler(async (req, res) => {
    const { id: userId } = req.user;

    // 1. KPI Data
    const totalIncidents = await Incident.countDocuments({ user: userId });
    const openIncidents = await Incident.countDocuments({ user: userId, status: { $ne: 'Closed' } });
    const totalAssets = await Asset.countDocuments({ user: userId });
    const overdueTasks = await Task.countDocuments({ user: userId, status: { $ne: 'Completed' }, dueDate: { $lt: new Date() } });

    // 2. Incidents by Priority Chart
    const incidentsByPriority = await Incident.aggregate([
        { $match: { user: new mongoose.Types.ObjectId(userId) } },
        { $group: { _id: '$priority', count: { $sum: 1 } } },
        { $sort: { _id: 1 } }
    ]);

    // 3. Tasks by Status Chart
    const tasksByStatus = await Task.aggregate([
        { $match: { user: new mongoose.Types.ObjectId(userId) } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $sort: { _id: 1 } }
    ]);

    res.json({
        kpis: {
            totalIncidents,
            openIncidents,
            totalAssets,
            overdueTasks,
        },
        charts: {
            incidentsByPriority,
            tasksByStatus,
        }
    });
});

module.exports = {
    getDashboardData,
};
