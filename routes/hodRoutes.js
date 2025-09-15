const express = require('express');
const router = express.Router();
const { 
  getDashboardData, 
  getAvailableStudents, 
  enrollStudentInDepartment 
} = require('../controllers/hodController');
const { protect } = require('../middlewares/authMiddleware');
const verifyRole = require('../middlewares/verifyRole');

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

module.exports = router;
