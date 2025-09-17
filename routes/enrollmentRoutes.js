const express = require('express');
const router = express.Router();
const { 
  requestEnrollment,
  respondToEnrollment,
  getAllEnrollments,
  getEnrollmentsByClass
} = require('../controllers/enrollmentController');
const { protect } = require('../middlewares/authMiddleware'); // Correctly import 'protect'
const verifyRole = require('../middlewares/verifyRole');

// --- Enrollment Routes ---

// Student requests to enroll in a class
router.post(
  '/request',
  protect, // Use the 'protect' function
  verifyRole(['student']),
  requestEnrollment
);

// Teacher or HOD responds to an enrollment request
router.post(
  '/respond',
  protect, // Use the 'protect' function
  verifyRole(['teacher', 'HOD']),
  respondToEnrollment
);

// Admin, HOD, or teacher gets all enrollment requests
router.get(
  '/all',
  protect, // Use the 'protect' function
  verifyRole(['admin', 'HOD', 'teacher']),
  getAllEnrollments
);

// Get enrollments for a specific class (for teachers)
router.get(
  '/class/:classId',
  protect,
  verifyRole(['teacher', 'HOD']),
  getEnrollmentsByClass
);

module.exports = router;