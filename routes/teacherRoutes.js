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
  getVenueAnnouncements
} = require('../controllers/teacherController');
const authMiddleware = require('../middlewares/authMiddleware');
const verifyRole = require('../middlewares/verifyRole');

// Dashboard and attendance routes
// @route   GET /api/teacher/dashboard
// @desc    Get data for the teacher dashboard
// @access  Private (Teacher)
router.get('/dashboard', authMiddleware, verifyRole(['teacher']), getDashboardData);

// @route   POST /api/teacher/attendance
// @desc    Mark student attendance
// @access  Private (Teacher)
router.post('/attendance', authMiddleware, verifyRole(['teacher']), markAttendance);

// Class management routes
// @route   POST /api/teacher/class
// @desc    Create a new class
// @access  Private (Teacher)
router.post('/class', authMiddleware, verifyRole(['teacher']), createClass);

// @route   PUT /api/teacher/class/:id
// @desc    Update a class
// @access  Private (Teacher)
router.put('/class/:id', authMiddleware, verifyRole(['teacher']), updateClass);

// @route   DELETE /api/teacher/class/:id
// @desc    Delete a class
// @access  Private (Teacher)
router.delete('/class/:id', authMiddleware, verifyRole(['teacher']), deleteClass);

// @route   GET /api/teacher/classes
// @desc    Get all classes for the logged-in teacher
// @access  Private (Teacher)
router.get('/classes', authMiddleware, verifyRole(['teacher']), getTeacherClasses);

// Venue announcement routes
// @route   POST /api/teacher/class/:id/venue-announcement
// @desc    Add a venue announcement for a class
// @access  Private (Teacher)
router.post('/class/:id/venue-announcement', authMiddleware, verifyRole(['teacher']), addVenueAnnouncement);

// @route   PUT /api/teacher/class/:id/venue-announcement/:announcementId
// @desc    Update a venue announcement
// @access  Private (Teacher)
router.put('/class/:id/venue-announcement/:announcementId', authMiddleware, verifyRole(['teacher']), updateVenueAnnouncement);

// @route   GET /api/teacher/class/:id/venue-announcements
// @desc    Get venue announcements for a class
// @access  Private (Teacher)
router.get('/class/:id/venue-announcements', authMiddleware, verifyRole(['teacher']), getVenueAnnouncements);

module.exports = router;
