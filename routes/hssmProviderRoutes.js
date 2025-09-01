const express = require('express');
const router = express.Router();
const { getDashboardData } = require('../controllers/hssmProviderController');
const authMiddleware = require('../middlewares/authMiddleware');
const { verifyRole } = require('../middlewares/verifyRole');

// @route   GET /api/hssm-provider/dashboard
// @desc    Get data for HSSM Provider dashboard
// @access  Private (HSSM-Provider)
router.get('/dashboard', authMiddleware, verifyRole(['HSSM-provider']), getDashboardData);

module.exports = router;
