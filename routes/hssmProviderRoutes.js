const express = require('express');
const router = express.Router();
const { getDashboardData } = require('../controllers/hssmProviderController');
const { protect } = require('../middlewares/authMiddleware');
const verifyRole = require('../middlewares/verifyRole');

// @route   GET /api/hssm-provider/dashboard
// @desc    Get data for HSSM Provider dashboard
// @access  Private (HSSM-Provider)
router.get('/dashboard', protect, verifyRole(['HSSM-provider']), getDashboardData);

module.exports = router;
