const express = require('express');
const router = express.Router();
const { getDashboardData } = require('../controllers/dashboardControllers');
const { protect } = require('../middlewares/authMiddleware'); // Correctly import 'protect'

// Get dashboard data for the logged-in user
router.get('/', protect, getDashboardData); // Use the 'protect' function

module.exports = router;