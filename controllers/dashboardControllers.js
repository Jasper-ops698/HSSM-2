const Enrollment = require('../models/Enrollment');
const Class = require('../models/Class');
const User = require('../models/User');
const Notification = require('../models/Notification');
const Announcement = require('../models/Announcement');

// @desc    Get dashboard data for the logged-in user
// @route   GET /api/dashboard
// @access  Private
const getDashboardData = async (req, res) => {
  try {
    const user = req.user; // User is already fetched fresh from DB in authMiddleware
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    let data = {
      user: {
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
      },
    };

    // Get common data for all users
    const [notifications, announcements] = await Promise.all([
      Notification.find({ recipient: user._id }).sort({ createdAt: -1 }).limit(5),
      getRelevantAnnouncements(user)
    ]);

    data.notifications = notifications;
    data.announcements = announcements;

    // Customize data based on user role
    switch (user.role) {
      case 'student':
        const enrollments = await Enrollment.find({ student: user._id }).populate({
          path: 'class',
          populate: {
            path: 'teacher',
            select: 'name',
          },
        });
        data.enrollments = enrollments;
        data.enrolledClassesCount = enrollments.length;
        data.credits = user.credits || 0;
        data.pendingEnrollmentsCount = enrollments.filter(e => e.status === 'Pending').length;
        data.approvedEnrollmentsCount = enrollments.filter(e => e.status === 'Approved').length;
        break;

      case 'teacher':
        const classes = await Class.find({ teacher: user._id }).populate('teacher', 'name');
        data.classes = classes;
        data.kpi = {
          totalClasses: classes.length,
          enrolledStudents: classes.reduce((total, cls) => total + (cls.enrolledStudents?.length || 0), 0)
        };
        break;

      case 'HOD':
        const hodClasses = await Class.find({ department: user.department }).populate('teacher', 'name');
        const [hodTeachers, hodEnrollments] = await Promise.all([
          User.find({ role: 'teacher', department: user.department }).select('name email'),
          Enrollment.find({
            class: { $in: hodClasses.map(c => c._id) }
          }).populate('student', 'name email credits').populate('class', 'name')
        ]);

        const uniqueStudents = new Set();
        hodEnrollments.forEach(enrollment => {
          if (enrollment.status === 'Approved') {
            uniqueStudents.add(enrollment.student._id.toString());
          }
        });

        data.teachers = hodTeachers;
        data.classes = hodClasses;
        data.enrollments = hodEnrollments;
        data.totalTeachers = hodTeachers.length;
        data.totalClasses = hodClasses.length;
        data.totalStudents = uniqueStudents.size;
        data.pendingEnrollmentsCount = hodEnrollments.filter(e => e.status === 'Pending').length;
        break;

      case 'credit-controller':
        const allStudents = await User.find({ role: 'student' }).select('name email credits');
        const lowCreditStudents = allStudents.filter(student => (student.credits || 0) < 10);

        // Calculate today's actions
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const CreditTransaction = require('../models/CreditTransaction');
        const actionsToday = await CreditTransaction.countDocuments({
          createdAt: { $gte: today, $lt: tomorrow }
        });

        data.students = allStudents;
        data.totalStudents = allStudents.length;
        data.lowCreditStudentsCount = lowCreditStudents.length;
        data.totalCreditsInSystem = allStudents.reduce((total, student) => total + (student.credits || 0), 0);
        data.actionsToday = actionsToday;
        break;

      case 'admin':
        const [studentCount, teacherCount, classCount, enrollmentCount] = await Promise.all([
          User.countDocuments({ role: 'student' }),
          User.countDocuments({ role: 'teacher' }),
          Class.countDocuments(),
          Enrollment.countDocuments()
        ]);

        data.kpi = {
          studentCount,
          teacherCount,
          classCount,
          enrollmentCount,
          totalUsers: await User.countDocuments()
        };
        break;

      case 'HSSM-provider':
        // Basic HSSM provider data - can be expanded
        data.kpi = {
          facilitiesManaged: 0, // Placeholder
          reportsGenerated: 0  // Placeholder
        };
        break;

      default:
        data.kpi = {};
    }

    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};

// Helper function to get relevant announcements for a user
const getRelevantAnnouncements = async (user) => {
  try {
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
        { targetRoles: user.role },
        { department: user.department }
      ]
    })
    .sort({ priority: -1, createdAt: -1 })
    .limit(5);

    return announcements;
  } catch (error) {
    console.error('Error fetching announcements:', error);
    return [];
  }
};

module.exports = {
  getDashboardData,
};