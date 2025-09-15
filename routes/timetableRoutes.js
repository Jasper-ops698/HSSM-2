const express = require('express');
const router = express.Router();
const timetableController = require('../controllers/timetableController');
const { protect, admin } = require('../middlewares/authMiddleware');
const multer = require('multer');

// Setup multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// @route   POST /api/timetable/upload
// @desc    Upload and process timetable from Excel file
// @access  Private/HOD
router.post('/upload', protect, upload.single('timetable'), timetableController.uploadTimetable);

// @route   GET /api/timetable
// @desc    Get all timetable entries
// @access  Private
router.get('/', protect, timetableController.getTimetable);

module.exports = router;
