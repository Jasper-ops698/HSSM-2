const Enrollment = require('../models/Enrollment');
const Class = require('../models/Class');
const User = require('../models/User');

// @desc    Get dashboard data for the logged-in user
// @route   GET /api/dashboard
// @access  Private
const getDashboardData = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    let data = {
      user: {
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };

    // Customize data based on user role
    if (user.role === 'student') {
      const enrollments = await Enrollment.find({ student: user._id }).populate({
        path: 'class',
        populate: {
          path: 'teacher',
          select: 'name',
        },
      });
      data.enrollments = enrollments;
    } else if (user.role === 'teacher') {
      const classes = await Class.find({ teacher: user._id }).populate('teacher', 'name');
      data.classes = classes;
    } else if (user.role === 'admin' || user.role === 'HOD') {
        const studentCount = await User.countDocuments({ role: 'student' });
        const teacherCount = await User.countDocuments({ role: 'teacher' });
        const classCount = await Class.countDocuments();
        const enrollmentCount = await Enrollment.countDocuments();
        data.stats = { studentCount, teacherCount, classCount, enrollmentCount };
    }

    res.status(200).json({ success: true, kpi: data });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};

module.exports = {
  getDashboardData,
};