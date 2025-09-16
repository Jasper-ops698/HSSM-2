const User = require('../models/User');
const Class = require('../models/Class');
const Timetable = require('../models/Timetable');
const Notification = require('../models/Notification');
const Announcement = require('../models/Announcement');

// @desc    Get all data for the student dashboard
// @route   GET /api/student/dashboard
// @access  Private (Student)
exports.getDashboardData = async (req, res) => {
  try {
    const studentId = req.user.id;
    const studentDepartment = req.user.department;

    // Get student data including credits
    const student = await User.findById(studentId).select('name email credits department');

    // Find classes the student is enrolled in
    const studentClasses = await Class.find({ enrolledStudents: studentId }).populate('teacher', 'name');

    // Get recent notifications for the student
    const notifications = await Notification.find({ recipient: studentId }).sort({ createdAt: -1 }).limit(5);

    // Get relevant announcements
    const currentDate = new Date();
    const announcements = await Announcement.find({
      active: true,
      startDate: { $lte: currentDate },
      $or: [
        { endDate: null },
        { endDate: { $gte: currentDate } }
      ],
      $or: [
        { targetRoles: 'all' },
        { targetRoles: 'student' },
        { department: studentDepartment }
      ]
    })
    .sort({ priority: -1, createdAt: -1 })
    .limit(5);

    res.json({
      student: student,
      classes: studentClasses,
      notifications,
      announcements
    });
  } catch (error) {
    console.error('Error fetching student dashboard data:', error);
    res.status(500).json({ msg: 'Server Error' });
  }
};

module.exports = {
  getDashboardData: exports.getDashboardData,
};
