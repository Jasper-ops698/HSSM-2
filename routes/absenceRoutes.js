const express = require('express');
const router = express.Router();
const absenceController = require('../controllers/absenceController');
const { protect, teacher, hod } = require('../middlewares/authMiddleware');

// @route   POST /api/absence/report
// @desc    Report absence (for teachers)
// @access  Private/Teacher
router.post('/report', protect, teacher, absenceController.reportAbsence);

// @route   GET /api/absence
// @desc    Get absences for HOD's department
// @access  Private/HOD
router.get('/', protect, hod, absenceController.getAbsences);

// @route   POST /api/absence/assign-replacement
// @desc    Assign replacement teacher
// @access  Private/HOD
router.post('/assign-replacement', protect, hod, absenceController.assignReplacement);

module.exports = router;
