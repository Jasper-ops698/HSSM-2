const express = require('express');
const router = express.Router();
const absenceController = require('../controllers/absenceController');
const { protect } = require('../middlewares/authMiddleware');
const verifyRole = require('../middlewares/verifyRole');

// @route   POST /api/absence/report
// @desc    Report absence (for teachers)
// @access  Private/Teacher
router.post('/report', protect, verifyRole(['teacher']), absenceController.reportAbsence);

// @route   GET /api/absence
// @desc    Get absences for HOD's department
// @access  Private/HOD
router.get('/', protect, verifyRole(['HOD']), absenceController.getAbsences);

// @route   POST /api/absence/assign-replacement
// @desc    Assign replacement teacher
// @access  Private/HOD
router.post('/assign-replacement', protect, verifyRole(['HOD']), absenceController.assignReplacement);

module.exports = router;
