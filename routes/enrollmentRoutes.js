const express = require('express');
const router = express.Router();
const { 
  requestEnrollment,
  respondToEnrollment,
  getAllEnrollments,
} = require('../controllers/enrollmentController');
const authMiddleware = require('../middlewares/authMiddleware');
const verifyRole = require('../middlewares/verifyRole');

// --- Enrollment Routes ---

// Student requests to enroll in a class
router.post(
  '/request',
  authMiddleware,
  verifyRole(['student']),
  requestEnrollment
);

// Teacher or HOD responds to an enrollment request
router.post(
  '/respond',
  authMiddleware,
  verifyRole(['teacher', 'HOD']),
  respondToEnrollment
);

// Admin or HOD gets all enrollment requests
router.get(
  '/all',
  authMiddleware,
  verifyRole(['admin', 'HOD']),
  getAllEnrollments
);

module.exports = router;
