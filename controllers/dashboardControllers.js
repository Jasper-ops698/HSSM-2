const Enrollment = require('../models/Enrollment');
const Class = require('../models/Class');
const User = require('../models/User');

exports.getDashboard = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // --- KPI and Query Logic (Role-Dependent) ---
    let creditBalance = 0;
    let kpiMatchQuery = {};
    let listQuery = {};

    if (req.user.role === 'student') {
      const userWithCredits = await User.findById(req.user._id).select('credits');
      creditBalance = userWithCredits ? userWithCredits.credits : 0;
      kpiMatchQuery = { student: req.user._id };
      listQuery = { student: req.user._id };
    } else if (req.user.role === 'teacher') {
      // For teachers, KPIs are based on enrollments in their classes
      const teacherClasses = await Class.find({ teacher: req.user._id }).select('_id');
      const classIds = teacherClasses.map(c => c._id);
      kpiMatchQuery = { class: { $in: classIds } };
      listQuery = { class: { $in: classIds } };
    } else {
      return res.status(403).json({ message: 'Access denied for this role.' });
    }

    // --- Fetch KPI Data ---
    const enrollmentStats = await Enrollment.aggregate([
      { $match: kpiMatchQuery },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const statsObject = enrollmentStats.reduce((acc, stat) => {
      acc[stat._id] = stat.count;
      return acc;
    }, {});
    
    const totalEnrollments = await Enrollment.countDocuments(kpiMatchQuery);


    // --- Filtering for the main enrollment list ---
    if (req.query.status) {
      listQuery.status = req.query.status;
    }
    if (req.query.className) {
        const classes = await Class.find({ name: { $regex: req.query.className, $options: 'i' } }).select('_id');
        const classIds = classes.map(c => c._id);
        listQuery.class = { $in: classIds };
    }
    if (req.query.startDate && req.query.endDate) {
      const startDate = new Date(req.query.startDate);
      const endDate = new Date(req.query.endDate);
      if (isNaN(startDate) || isNaN(endDate)) {
        return res.status(400).json({ message: 'Invalid date format' });
      }
      listQuery.createdAt = { $gte: startDate, $lte: endDate };
    }

    // --- Sorting ---
    const sortOptions = {};
    if (req.query.sortBy) {
      const sortBy = req.query.sortBy;
      const sortOrder = req.query.sortOrder === 'desc' ? -1 : 1;
      if (['createdAt', 'status'].includes(sortBy)) {
        sortOptions[sortBy] = sortOrder;
      } else {
        return res.status(400).json({ message: 'Invalid sortBy value.' });
      }
    } else {
        sortOptions.createdAt = -1; // Default sort
    }

    // --- Pagination ---
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // --- Fetching and Response ---
    const populateOptions = [
      { path: 'class', model: 'Class', select: 'name description creditsRequired' },
      { path: 'student', model: 'User', select: 'name email' },
    ];

    const enrollments = await Enrollment.find(listQuery)
      .populate(populateOptions)
      .sort(sortOptions)
      .skip(skip)
      .limit(limit);

    const totalFilteredEnrollments = await Enrollment.countDocuments(listQuery);

    res.status(200).json({
      kpi: {
        creditBalance,
        totalEnrollments: totalEnrollments,
        pendingEnrollments: statsObject.Pending || 0,
        approvedEnrollments: statsObject.Approved || 0,
        // Assuming 'Completed' is a valid status you might add later
        completedEnrollments: statsObject.Completed || 0, 
      },
      role: req.user.role,
      totalEnrollments: totalFilteredEnrollments,
      totalPages: Math.ceil(totalFilteredEnrollments / limit),
      currentPage: page,
      enrollments,
    });
  } catch (err) {
    console.error('Error fetching dashboard data:', err);
    res.status(500).json({ message: 'Error fetching dashboard data', error: err.message });
  }
};
