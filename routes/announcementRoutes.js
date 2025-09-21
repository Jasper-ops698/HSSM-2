// @route   PATCH /api/announcements/mark-all-read
// @desc    Mark all announcements as read for the current student (soft delete)
// @access  Private (Student)
const express = require('express');
const router = express.Router();
const { 
  createAnnouncement, 
  getAnnouncements, 
  getAnnouncementById, 
  updateAnnouncement, 
  deleteAnnouncement,
  toggleAnnouncementStatus,
  deleteAllAnnouncements,
  getMyAnnouncements,
  markAllAnnouncementsAsRead
} = require('../controllers/announcementController');
const { protect } = require('../middlewares/authMiddleware');
const verifyRole = require('../middlewares/verifyRole');

// mark all announcements as read for current student
router.patch('/mark-all-read', protect, verifyRole(['student']), markAllAnnouncementsAsRead);


// @route   POST /api/announcements
// @desc    Create a new announcement
// @access  Private (Admin, HOD, Teacher)
router.post(
  '/', 
  protect, 
  verifyRole(['admin', 'HOD', 'teacher']), 
  createAnnouncement
);

// @route   GET /api/announcements
// @desc    Get all announcements (with filtering)
// @access  Private
router.get('/', protect, getAnnouncements);

// @route   GET /api/announcements/:id
// @desc    Get a single announcement by ID
// @access  Private
router.get('/:id', protect, getAnnouncementById);

// @route   PUT /api/announcements/:id
// @desc    Update an announcement
// @access  Private (Admin, HOD, Teacher - original creator)
router.put(
  '/:id', 
  protect, 
  verifyRole(['admin', 'HOD', 'teacher']), 
  updateAnnouncement
);

// @route   PATCH /api/announcements/:id/status
// @desc    Toggle announcement active status
// @access  Private (Admin, HOD, Teacher - original creator)
router.patch(
  '/:id/status', 
  protect, 
  verifyRole(['admin', 'HOD', 'teacher']), 
  toggleAnnouncementStatus
);

// @route   DELETE /api/announcements/:id
// @desc    Delete an announcement
// @access  Private (Admin, HOD, Teacher - original creator)
router.delete(
  '/:id', 
  protect, 
  verifyRole(['admin', 'HOD', 'teacher']), 
  deleteAnnouncement
);


// @route   DELETE /api/announcements/delete-all
// @desc    Delete all announcements for the current user
// @access  Private
router.delete('/delete-all', protect, deleteAllAnnouncements);

// @route   GET /api/announcements/my-announcements
// @desc    Get all announcements created by the logged-in user
// @access  Private (HOD, Teacher)
router.get('/my-announcements', protect, verifyRole(['HOD', 'teacher']), getMyAnnouncements);

module.exports = router;
