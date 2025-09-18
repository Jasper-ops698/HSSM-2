const express = require('express');
const router = express.Router();
const { 
  getDashboardData, 
  getAvailableStudents, 
  enrollStudentInDepartment,
  createAnnouncement
} = require('../controllers/hodController');
const { protect } = require('../middlewares/authMiddleware');
const verifyRole = require('../middlewares/verifyRole');
const User = require('../models/User');

// @route   GET /api/hod/dashboard
// @desc    Get data for HOD dashboard
// @access  Private (HOD)
router.get('/dashboard', protect, verifyRole(['HOD']), getDashboardData);

// @route   GET /api/hod/available-students
// @desc    Get students available for enrollment in department
// @access  Private (HOD)
router.get('/available-students', protect, verifyRole(['HOD']), getAvailableStudents);

// @route   POST /api/hod/enroll-student
// @desc    Enroll student into HOD's department
// @access  Private (HOD)
router.post('/enroll-student', protect, verifyRole(['HOD']), enrollStudentInDepartment);

// @route   GET /api/hod/teachers
// @desc    Get teachers in HOD's department
// @access  Private (HOD)
router.get('/teachers', protect, verifyRole(['HOD']), async (req, res) => {
  try {
    const hodDepartment = req.user.department;
    
    if (!hodDepartment) {
      return res.status(403).json({ message: 'Access denied. No department assigned to this HOD.' });
    }

    const teachers = await User.find({ role: 'teacher', department: hodDepartment })
      .select('name email _id')
      .sort('name');
    
    res.json(teachers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   POST /api/hod/announcements
// @desc    Create an announcement for the department
// @access  Private (HOD)
router.post('/announcements', protect, verifyRole(['HOD']), createAnnouncement);

module.exports = router;
