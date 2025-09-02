const express = require('express');
const router = express.Router();
const {
  createClass,
  getAllClasses,
  updateClass,
  deleteClass,
  getClassesByTeacher,
  getStudentsByClass,
} = require('../controllers/classController');
const { protect } = require('../middlewares/authMiddleware'); // Correctly import 'protect'
const verifyRole = require('../middlewares/verifyRole');

// --- Class Routes ---

// Create a new class (only admin or HOD)
router.post(
  '/',
  protect, // Use the 'protect' function
  verifyRole(['admin', 'HOD']),
  createClass
);

// Get all classes (accessible to all authenticated users)
router.get('/', protect, getAllClasses); // Use the 'protect' function

// Update a class (only admin or HOD)
router.put(
  '/:id',
  protect, // Use the 'protect' function
  verifyRole(['admin', 'HOD']),
  updateClass
);

// Delete a class (only admin or HOD)
router.delete(
  '/:id',
  protect, // Use the 'protect' function
  verifyRole(['admin', 'HOD']),
  deleteClass
);

// Get classes assigned to a specific teacher
router.get(
  '/teacher/:teacherId',
  protect, // Use the 'protect' function
  verifyRole(['teacher', 'admin', 'HOD']),
  getClassesByTeacher
);

// Get all students enrolled in a specific class
router.get(
  '/:classId/students',
  protect, // Use the 'protect' function
  verifyRole(['teacher', 'admin', 'HOD']),
  getStudentsByClass
);

module.exports = router;