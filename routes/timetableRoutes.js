const express = require('express');
const router = express.Router();
const timetableController = require('../controllers/timetableController');
const { protect } = require('../middlewares/authMiddleware');
const verifyRole = require('../middlewares/verifyRole');
const multer = require('multer');

// Setup multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// @route   POST /api/timetable/preview
// @desc    Preview timetable data from Excel file without saving
// @access  Private/HOD
router.post('/preview', protect, verifyRole(['HOD']), upload.single('timetable'), timetableController.previewTimetable);

// @route   POST /api/timetable/upload
// @desc    Upload and process timetable from Excel file
// @access  Private/HOD
router.post('/upload', protect, verifyRole(['HOD']), upload.single('timetable'), timetableController.uploadTimetable);

// @route   GET /api/timetable
// @desc    Get all timetable entries
// @access  Private
router.get('/', protect, timetableController.getTimetable);

// @route   GET /api/timetable/student
// @desc    Get timetable for current student
// @access  Private/Student
router.get('/student', protect, timetableController.getStudentTimetable);

// @route   GET /api/timetable/teacher
// @desc    Get timetable for current teacher
// @access  Private/Teacher
router.get('/teacher', protect, timetableController.getTeacherTimetable);

// @route   GET /api/timetable/today
// @desc    Get today's timetable for current student
// @access  Private/Student
router.get('/today', protect, timetableController.getTodayTimetable);

// @route   POST /api/timetable/:id/assign-replacement
// @desc    Assign a replacement teacher to a timetable entry (HOD/Admin)
// @access  Private/HOD or Admin
router.post('/:id/assign-replacement', protect, verifyRole(['HOD', 'admin']), timetableController.assignReplacement);

// @route   GET /api/timetable/class/:classId
// @desc    Get timetable entries for a specific class (HOD/Admin/Teacher)
// @access  Private
router.get('/class/:classId', protect, verifyRole(['HOD', 'admin', 'teacher']), timetableController.getEntriesForClass);

module.exports = router;
