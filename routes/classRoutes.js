const express = require('express');
const router = express.Router();
const {
  createClass,
  teacherCreateClass,
  getAllClasses,
  updateClass,
  deleteClass,
  getClassesByTeacher,
  getStudentsByClass,
} = require('../controllers/classController');
const { protect } = require('../middlewares/authMiddleware'); // Correctly import 'protect'
const verifyRole = require('../middlewares/verifyRole');

// --- Class Routes ---

// Create a new class (admin, HOD, or teacher)
router.post(
  '/',
  protect, // Use the 'protect' function
  verifyRole(['admin', 'HOD', 'teacher']),
  createClass
);

// Create a new class by teacher
router.post(
  '/teacher',
  protect,
  verifyRole(['teacher']),
  teacherCreateClass
);

// Get all classes (accessible to all authenticated users)
router.get('/', protect, getAllClasses); // Use the 'protect' function

// Update a class (admin, HOD, or teacher)
router.put(
  '/:id',
  protect, // Use the 'protect' function
  verifyRole(['admin', 'HOD', 'teacher']),
  updateClass
);

// Delete a class (admin, HOD, or teacher)
router.delete(
  '/:id',
  protect, // Use the 'protect' function
  verifyRole(['admin', 'HOD', 'teacher']),
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