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

// @route   POST /api/absence
// @desc    Create absence (for both students and teachers)
// @access  Private
router.post('/', protect, upload.single('evidence'), absenceController.createAbsence);

// @route   POST /api/absence/report
// @desc    Report absence (for teachers)
// @access  Private/Teacher
router.post('/report', protect, verifyRole(['teacher']), absenceController.reportAbsence);

// @route   GET /api/absence
// @desc    Get absences for HOD's department
// @access  Private/HOD
router.get('/', protect, verifyRole(['HOD']), absenceController.getAbsences);

// @route   GET /api/absence/teacher
// @desc    Get absences for current teacher
// @access  Private/Teacher
router.get('/teacher', protect, verifyRole(['teacher']), absenceController.getTeacherAbsences);

// @route   POST /api/absence/respond
// @desc    Respond to absence request (HOD)
// @access  Private/HOD
router.post('/respond', protect, verifyRole(['HOD']), absenceController.respondToAbsence);

// @route   POST /api/absence/assign-replacement
// @desc    Assign replacement teacher
// @access  Private/HOD
router.post('/assign-replacement', protect, verifyRole(['HOD']), absenceController.assignReplacement);

module.exports = router;
