const express = require('express');
const router = express.Router();
const timetableController = require('../controllers/timetableController');
const { protect, admin } = require('../middlewares/authMiddleware');
const multer = require('multer');

// Setup multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// @route   POST /api/timetable/preview
// @desc    Preview timetable data from Excel file without saving
// @access  Private/HOD
router.post('/preview', protect, upload.single('timetable'), timetableController.previewTimetable);

// @route   POST /api/timetable/upload
// @desc    Upload and process timetable from Excel file
// @access  Private/HOD
router.post('/upload', protect, upload.single('timetable'), timetableController.uploadTimetable);

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

module.exports = router;
