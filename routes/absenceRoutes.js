const express = require('express');
const router = express.Router();
const absenceController = require('../controllers/absenceController');
const { protect } = require('../middlewares/authMiddleware');
const verifyRole = require('../middlewares/verifyRole');
const multer = require('multer');
const path = require('path');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// @route   POST /api/absences
// @desc    Create absence (for both students and teachers)
// @access  Private
router.post('/', protect, upload.single('evidence'), absenceController.createAbsence);

// @route   POST /api/absences/report
// @desc    Report absence (for teachers)
// @access  Private/Teacher
router.post('/report', protect, verifyRole(['teacher']), absenceController.reportAbsence);

// @route   GET /api/absences
// @desc    Get absences for HOD's department
// @access  Private/HOD
router.get('/', protect, verifyRole(['HOD']), absenceController.getAbsences);

// @route   GET /api/absences/teacher
// @desc    Get absences for current teacher
// @access  Private/Teacher
router.get('/teacher', protect, verifyRole(['teacher']), absenceController.getTeacherAbsences);

// @route   POST /api/absences/student
// @desc    Create student absence
// @access  Private/Student
router.post('/student', protect, verifyRole(['student']), upload.single('evidence'), absenceController.createAbsence);

// @route   POST /api/absences/respond
// @desc    Respond to absence request (HOD)
// @access  Private/HOD
router.post('/respond', protect, verifyRole(['HOD']), absenceController.respondToAbsence);

// @route   POST /api/absences/assign-replacement
// @desc    Assign replacement teacher
// @access  Private/HOD
router.post('/assign-replacement', protect, verifyRole(['HOD']), absenceController.assignReplacement);

// @route   GET /api/absence/:id
// @desc    Get a single absence by ID
// @access  Private (HOD, teacher, or student with access)
router.get('/:id', protect, absenceController.getAbsenceById);

module.exports = router;
