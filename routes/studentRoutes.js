const express = require('express');
const router = express.Router();
const { getDashboardData } = require('../controllers/studentController');
const authMiddleware = require('../middlewares/authMiddleware');
const verifyRole = require('../middlewares/verifyRole');

// @route   GET /api/student/dashboard
// @desc    Get all data for the student dashboard
// @access  Private (Student)
router.get('/dashboard', authMiddleware, verifyRole(['student']), getDashboardData);

module.exports = router;
