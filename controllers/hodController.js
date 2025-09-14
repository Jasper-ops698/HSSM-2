const User = require('../models/User');
const Class = require('../models/Class');
const Enrollment = require('../models/Enrollment');

// @desc    Get data for HOD Dashboard, scoped to their department
// @route   GET /api/hod/dashboard
// @access  Private/HOD
const getDashboardData = async (req, res) => {
  try {
    const hodDepartment = req.user.department;

    if (!hodDepartment) {
      return res.status(403).json({ message: 'Access denied. No department assigned to this HOD.' });
    }

    // --- Data Fetching (Scoped to Department) ---
    const teachers = await User.find({ role: 'teacher', department: hodDepartment }).select('name email');
    const classes = await Class.find({ department: hodDepartment }).populate('teacher', 'name');
    
    const classIdsInDepartment = classes.map(c => c._id);
    
    const enrollments = await Enrollment.find({ class: { $in: classIdsInDepartment } })
        .populate('student', 'name email credits')
        .populate('class', 'name');

    // --- KPI Calculation ---
    const totalTeachers = teachers.length;
    const totalClasses = classes.length;
    
    const uniqueStudentIds = new Set();
    enrollments.forEach(enrollment => {
        if(enrollment.status === 'Approved') {
            uniqueStudentIds.add(enrollment.student._id.toString());
        }
    });
    const totalStudentsInDept = uniqueStudentIds.size;

    const pendingEnrollmentsCount = enrollments.filter(e => e.status === 'Pending').length;

    res.json({
      kpi: {
        totalTeachers,
        totalClasses,
        totalStudents: totalStudentsInDept,
        pendingEnrollments: pendingEnrollmentsCount,
      },
      teachers,
      classes,
      enrollments, // Full enrollment details for management
    });
  } catch (error) {
    console.error('Error fetching HOD dashboard data:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getDashboardData,
};
