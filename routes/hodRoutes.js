const express = require('express');
const router = express.Router();
const { getDashboardData } = require('../controllers/hodController');
const { protect } = require('../middlewares/authMiddleware');
const verifyRole = require('../middlewares/verifyRole');

// @route   GET /api/hod/dashboard
// @desc    Get data for HOD dashboard
// @access  Private (HOD)
router.get('/dashboard', protect, verifyRole(['HOD']), getDashboardData);

module.exports = router;
