const express = require('express');
const router = express.Router();
const { 
  createAnnouncement, 
  getAnnouncements, 
  getAnnouncementById, 
  updateAnnouncement, 
  deleteAnnouncement 
} = require('../controllers/announcementController');
const { protect } = require('../middlewares/authMiddleware');
const verifyRole = require('../middlewares/verifyRole');

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

// @route   DELETE /api/announcements/:id
// @desc    Delete an announcement
// @access  Private (Admin, HOD, Teacher - original creator)
router.delete(
  '/:id', 
  protect, 
  verifyRole(['admin', 'HOD', 'teacher']), 
  deleteAnnouncement
);

module.exports = router;
