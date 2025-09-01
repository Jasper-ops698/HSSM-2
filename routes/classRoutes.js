const express = require('express');
const router = express.Router();
const { 
  createClass,
  updateClass,
  deleteClass,
  getTeacherClasses,
} = require('../controllers/teacherController');
const authMiddleware = require('../middlewares/authMiddleware');
const verifyRole = require('../middlewares/verifyRole');

// --- Class Management Routes (for Teachers) ---

// Teacher creates a new class
router.post(
  '/',
  authMiddleware,
  verifyRole(['teacher']),
  createClass
);

// Teacher updates their own class
router.put(
  '/:id',
  authMiddleware,
  verifyRole(['teacher']),
  updateClass
);

// Teacher deletes their own class
router.delete(
  '/:id',
  authMiddleware,
  verifyRole(['teacher']),
  deleteClass
);

// Teacher gets all of their classes
router.get(
  '/',
  authMiddleware,
  verifyRole(['teacher']),
  getTeacherClasses
);

module.exports = router;
