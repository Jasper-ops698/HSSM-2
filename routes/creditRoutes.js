const express = require('express');
const router = express.Router();
const { getDashboardData, addCredits, deductCredits } = require('../controllers/creditController');
const { protect } = require('../middlewares/authMiddleware');
const verifyRole = require('../middlewares/verifyRole');

// --- Credit Controller Routes ---

// Get dashboard data (list of students and their credits)
router.get(
  '/dashboard',
  protect,
  verifyRole(['credit-controller', 'admin']), // Protect this route
  getDashboardData
);

// Add credits to a user's account
router.post(
  '/add',
  protect,
  verifyRole(['credit-controller', 'admin']), // Protect this route
  addCredits
);

// Deduct credits from a user's account
router.post(
  '/deduct',
  protect,
  verifyRole(['credit-controller', 'admin']), // Protect this route
  deductCredits
);

module.exports = router;
