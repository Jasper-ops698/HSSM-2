const express = require('express');
const router = express.Router();
const { getDashboardData } = require('../controllers/hssmDashboardController');
const { protect } = require('../middlewares/authMiddleware');
const verifyRole = require('../middlewares/verifyRole');

// @route   GET /api/hssm/dashboard
router.route('/dashboard').get(protect, verifyRole(['HSSM-provider']), getDashboardData);

module.exports = router;
