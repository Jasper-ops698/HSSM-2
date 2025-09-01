const express = require('express');
const router = express.Router();
const { getDashboardData } = require('../controllers/hssmDashboardController');
const { protect, hssmProvider } = require('../middlewares/authMiddleware');

// @route   GET /api/hssm/dashboard
router.route('/dashboard').get(protect, hssmProvider, getDashboardData);

module.exports = router;
