const User = require('../models/User');
const Enrollment = require('../models/Enrollment');
const Class = require('../models/Class');
const Notification = require('../models/Notification');

// @desc    Get all data for admin dashboard analytics
// @route   GET /api/admin/data
// @access  Private/Admin
exports.getDashboardAnalytics = async (req, res) => {
  try {
    const [users, enrollments, classes] = await Promise.all([
      User.find(),
      Enrollment.find(),
      Class.find(),
    ]);

    // Prepare data for analytics
    const totalUsers = users.length;
    const totalEnrollments = enrollments.length;
    const totalClasses = classes.length;

    const userRoles = users.reduce((acc, user) => {
      acc[user.role] = (acc[user.role] || 0) + 1;
      return acc;
    }, {});

    const enrollmentStatuses = enrollments.reduce((acc, enrollment) => {
      acc[enrollment.status] = (acc[enrollment.status] || 0) + 1;
      return acc;
    }, {});

    const classesPerDepartment = classes.reduce((acc, cls) => {
      acc[cls.department] = (acc[cls.department] || 0) + 1;
      return acc;
    }, {});

    res.json({
      totalUsers,
      totalEnrollments,
      totalClasses,
      userRoles,
      enrollmentStatuses,
      classesPerDepartment,
      users, // For user management list
      classes, // For class management list
    });
  } catch (error) {
    res.status(500).json({ msg: 'Error fetching admin dashboard data', error: error.message });
  }
};

// @desc    Admin creates a new staff user (teacher, HOD, etc.)
// @route   POST /api/admin/create-staff
// @access  Private/Admin
exports.createStaffUser = async (req, res) => {
  try {
    const { name, email, password, role, department } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ msg: 'Name, email, password, and role are required.' });
    }

    if ((role === 'teacher' || role === 'HOD') && !department) {
      return res.status(400).json({ msg: 'Department is required for teachers and HODs.' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ msg: 'User with this email already exists.' });
    }

    const newUser = new User({
      name,
      email,
      password, // Password will be hashed by the pre-save hook in the User model
      role,
      department: (role === 'teacher' || role === 'HOD') ? department : undefined,
    });

    await newUser.save();
    res.status(201).json({ msg: 'Staff user created successfully.', user: newUser });
  } catch (error) {
    res.status(500).json({ msg: 'Error creating staff user', error: error.message });
  }
};

// @desc    Admin assigns a role and department to a user
// @route   POST /api/admin/assign-role
// @access  Private/Admin
exports.assignRoleAndDepartment = async (req, res) => {
  try {
    const { userId, role, department } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ msg: 'User not found.' });
    }

    if ((role === 'teacher' || role === 'HOD') && !department) {
      return res.status(400).json({ msg: 'Department is required for this role.' });
    }

    user.role = role;
    if (department) {
      user.department = department;
    }
    
    await user.save();

    await Notification.create({
      recipient: user._id,
      message: `Your role has been updated to ${role}.`,
      type: 'role_assigned',
    });

    res.json({ msg: 'User role and department updated successfully.' });
  } catch (error) {
    res.status(500).json({ msg: 'Error assigning role', error: error.message });
  }
};

// @desc    Admin deletes any user by ID
// @route   DELETE /api/admin/user/:id
// @access  Private/Admin
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ msg: 'User not found.' });
    }
    // Add check to prevent admin from deleting themselves
    if (user._id.toString() === req.user._id.toString()) {
        return res.status(400).json({ msg: 'Admin cannot delete themselves.' });
    }
    await user.deleteOne();
    res.json({ msg: 'User deleted successfully.' });
  } catch (error) {
    res.status(500).json({ msg: 'Error deleting user', error: error.message });
  }
};

// @desc    Admin disables or enables any user by ID
// @route   POST /api/admin/user/:id/toggle-disable
// @access  Private/Admin
exports.toggleUserDisabled = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ msg: 'User not found.' });
    }
     if (user._id.toString() === req.user._id.toString()) {
        return res.status(400).json({ msg: 'Admin cannot disable themselves.' });
    }
    user.isDisabled = !user.isDisabled;
    await user.save();
    res.json({ msg: `User ${user.isDisabled ? 'disabled' : 'enabled'} successfully.` });
  } catch (error) {
    res.status(500).json({ msg: 'Error toggling user status', error: error.message });
  }
};