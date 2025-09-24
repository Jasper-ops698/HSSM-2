const express = require('express');
const router = express.Router();
const { 
  getDashboardData, 
  markAttendance, 
  createClass, 
  updateClass, 
  deleteClass, 
  getTeacherClasses,
  addVenueAnnouncement,
  updateVenueAnnouncement,
  getVenueAnnouncements,
  getStudents,
  createAnnouncement
} = require('../controllers/teacherController');
const { protect } = require('../middlewares/authMiddleware');
const verifyRole = require('../middlewares/verifyRole');

// Dashboard and attendance routes
// @route   GET /api/teacher/dashboard
// @desc    Get data for the teacher dashboard
// @access  Private (Teacher)
router.get('/dashboard', protect, verifyRole(['teacher']), getDashboardData);

// @route   POST /api/teacher/attendance
// @desc    Mark student attendance
// @access  Private (Teacher)
router.post('/attendance', protect, verifyRole(['teacher']), markAttendance);
// Bulk attendance marking: accepts { classId, date, attendance: [{ studentId, status }, ...] }
router.post('/attendance/bulk', protect, verifyRole(['teacher']), require('../controllers/teacherController').bulkMarkAttendance);

// Class management routes
// @route   POST /api/teacher/class
// @desc    Create a new class
// @access  Private (Teacher)
router.post('/class', protect, verifyRole(['teacher']), createClass);

// @route   PUT /api/teacher/class/:id
// @desc    Update a class
// @access  Private (Teacher)
router.put('/class/:id', protect, verifyRole(['teacher']), updateClass);

// @route   DELETE /api/teacher/class/:id
// @desc    Delete a class
// @access  Private (Teacher)
router.delete('/class/:id', protect, verifyRole(['teacher']), deleteClass);

// @route   GET /api/teacher/classes
// @desc    Get all classes for the logged-in teacher
// @access  Private (Teacher)
router.get('/classes', protect, verifyRole(['teacher']), getTeacherClasses);

// Venue announcement routes
// @route   POST /api/teacher/class/:id/venue-announcement
// @desc    Add a venue announcement for a class
// @access  Private (Teacher)
router.post('/class/:id/venue-announcement', protect, verifyRole(['teacher']), addVenueAnnouncement);

// @route   PUT /api/teacher/class/:id/venue-announcement/:announcementId
// @desc    Update a venue announcement
// @access  Private (Teacher)
router.put('/class/:id/venue-announcement/:announcementId', protect, verifyRole(['teacher']), updateVenueAnnouncement);

// @route   GET /api/teacher/class/:id/venue-announcements
// @desc    Get venue announcements for a class
// @access  Private (Teacher)
router.get('/class/:id/venue-announcements', protect, verifyRole(['teacher']), getVenueAnnouncements);

// @route   GET /api/teacher/students
// @desc    Get all students in the teacher's department
// @access  Private (Teacher)
router.get('/students', protect, verifyRole(['teacher']), getStudents);

// @route   POST /api/teacher/announcements
// @desc    Create an announcement
// @access  Private (Teacher)
router.post('/announcements', protect, verifyRole(['teacher']), createAnnouncement);

module.exports = router;
