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
        const student = await User.findById(user._id).select('name email role department credits');
        if (!student) {
          return res.status(404).json({ success: false, message: 'Student not found' });
        }

        const enrollments = await Enrollment.find({ student: user._id }).populate({
          path: 'class',
          populate: {
            path: 'teacher',
            select: 'name',
          },
        });
        data.enrollments = enrollments;
        // Also provide a normalized list of enrolled class IDs as strings to
        // make it easy for frontend clients to check membership without
        // depending on populated objects' shape.
        data.enrolledClassIds = enrollments.map(en => en.class && en.class._id ? String(en.class._id) : null).filter(Boolean);
        data.kpi = {
          credits: student.credits || 0,
          enrolledClasses: enrollments.length,
          pendingEnrollments: enrollments.filter(e => e.status === 'Pending').length,
          approvedEnrollments: enrollments.filter(e => e.status === 'Approved').length,
        };
        break;

      case 'teacher':
        const classes = await Class.find({ teacher: user._id }).populate('teacher', 'name');

        // Get all students enrolled in teacher's classes
        const teacherClassIds = classes.map(c => c._id);
        const enrolledStudents = await Enrollment.find({
          class: { $in: teacherClassIds },
          status: 'Approved'
        }).populate('student', 'name email credits');

        // Get unique students
        const uniqueStudents = [...new Map(enrolledStudents.map(e =>
          [e.student._id.toString(), e.student])).values()];

        data.classes = classes;
        data.students = uniqueStudents;
        data.kpi = {
          totalClasses: classes.length,
          enrolledStudents: classes.reduce((total, cls) => total + (cls.enrolledStudents?.length || 0), 0),
          totalStudents: uniqueStudents.length,
          totalCredits: uniqueStudents.reduce((total, student) => total + (student.credits || 0), 0)
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

        const uniqueHodStudents = new Set();
        hodEnrollments.forEach(enrollment => {
          if (enrollment.status === 'Approved') {
            uniqueHodStudents.add(enrollment.student._id.toString());
          }
        });

        data.teachers = hodTeachers;
        data.classes = hodClasses;
        data.enrollments = hodEnrollments;
        data.totalTeachers = hodTeachers.length;
        data.totalClasses = hodClasses.length;
        data.totalStudents = uniqueHodStudents.size;
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
        // Get counts first
        const studentCount = await User.countDocuments({ role: 'student' });
        const teacherCount = await User.countDocuments({ role: 'teacher' });
        const classCount = await Class.countDocuments();
        const enrollmentCount = await Enrollment.countDocuments();
        const totalUsers = await User.countDocuments();

        // Fetch the actual data for admin dashboard
        const adminStudents = await User.find({ role: 'student' }).select('name email department credits');
        const adminTeachers = await User.find({ role: 'teacher' }).select('name email department');
        const adminClasses = await Class.find().populate('teacher', 'name');
        const adminEnrollments = await Enrollment.find().populate('student', 'name').populate('class', 'name');

        data.students = adminStudents;
        data.teachers = adminTeachers;
        data.classes = adminClasses;
        data.enrollments = adminEnrollments;
        data.studentCount = studentCount;
        data.teacherCount = teacherCount;
        data.classCount = classCount;
        data.enrollmentCount = enrollmentCount;
        data.totalUsers = totalUsers;
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