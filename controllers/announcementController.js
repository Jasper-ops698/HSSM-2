const Announcement = require('../models/Announcement');

// @desc    Create a new announcement
// @route   POST /api/announcements
// @access  Private (Admin, HOD, Teacher)
exports.createAnnouncement = async (req, res) => {
  try {
    const { title, message, content, department, targetRoles, priority, startDate, endDate, isActive, active } = req.body;
    
    // Handle field name differences (frontend uses 'content', backend uses 'message')
    const announcementMessage = message || content;
    
    // Basic validation
    if (!title || !announcementMessage) {
      return res.status(400).json({ message: 'Title and message are required' });
    }

    // Create announcement
    const announcement = new Announcement({
      title,
      message: announcementMessage,
      department: department || req.user.department,
      targetRoles: targetRoles || (req.user.role === 'admin' ? ['admin', 'HOD', 'teacher'] : ['all']),
      createdBy: req.user._id,
      active: active !== undefined ? active : (isActive !== undefined ? isActive : true),
      priority: priority || 'medium',
      startDate: startDate || new Date(),
      endDate: endDate || null
    });

    await announcement.save();
    res.status(201).json({ message: 'Announcement created successfully', announcement });
  } catch (error) {
    console.error('Error creating announcement:', error);
    res.status(500).json({ message: 'Server error while creating announcement' });
  }
};

// @desc    Get all announcements (with filtering)
// @route   GET /api/announcements
// @access  Private
exports.getAnnouncements = async (req, res) => {
  try {
    const { active, priority, department, role } = req.query;
    
    // Build query based on filters
    const query = {};
    
    // Active filter (default to true)
    query.active = active === 'false' ? false : true;
    
    // Priority filter
    if (priority && ['low', 'medium', 'high'].includes(priority)) {
      query.priority = priority;
    }
    
    // Department filter (for department-specific announcements)
    if (department) {
      query.department = department;
    }
    
    // Filter announcements based on the user's role
    const userRole = req.user.role;
    const userDepartment = req.user.department;
    
    // Complex query to get:
    // 1. Announcements targeted to all roles
    // 2. Announcements targeted to the user's specific role
    // 3. Announcements for the user's department (if applicable)
    query.$or = [
      { targetRoles: 'all' },
      { targetRoles: userRole }
    ];
    
    // Add department filter if the user has a department
    if (userDepartment) {
      query.$or.push({ department: userDepartment });
    }
    
    // Date-based filtering
    const currentDate = new Date();
    query.$and = [
      { startDate: { $lte: currentDate } },
      { $or: [{ endDate: null }, { endDate: { $gte: currentDate } }] }
    ];

    // Execute query with sorting (newer first)
    const announcements = await Announcement.find(query)
      .populate('createdBy', 'name role department')
      .sort({ priority: -1, createdAt: -1 });
    
    res.status(200).json(announcements);
  } catch (error) {
    console.error('Error fetching announcements:', error);
    res.status(500).json({ message: 'Server error while fetching announcements' });
  }
};

// @desc    Get a single announcement by ID
// @route   GET /api/announcements/:id
// @access  Private
exports.getAnnouncementById = async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.id)
      .populate('createdBy', 'name role department');
    
    if (!announcement) {
      return res.status(404).json({ message: 'Announcement not found' });
    }
    
    res.status(200).json(announcement);
  } catch (error) {
    console.error('Error fetching announcement:', error);
    res.status(500).json({ message: 'Server error while fetching announcement' });
  }
};

// @desc    Update an announcement
// @route   PUT /api/announcements/:id
// @access  Private (Admin, HOD, Teacher - original creator)
exports.updateAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    // Find announcement
    const announcement = await Announcement.findById(id);
    
    if (!announcement) {
      return res.status(404).json({ message: 'Announcement not found' });
    }
    
    // Check permission - only allow creator, admins, or HODs to update
    const isCreator = announcement.createdBy.toString() === req.user._id.toString();
    const canEdit = isCreator || req.user.role === 'admin' || req.user.role === 'HOD';
    
    if (!canEdit) {
      return res.status(403).json({ message: 'Not authorized to update this announcement' });
    }
    
    // Handle field name mappings
    if (updates.content !== undefined) {
      announcement.message = updates.content;
    }
    if (updates.isActive !== undefined) {
      announcement.active = updates.isActive;
    }
    
    // Update fields
    const allowedUpdates = ['title', 'message', 'active', 'priority', 'targetRoles', 'endDate'];
    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        announcement[field] = updates[field];
      }
    });
    
    await announcement.save();
    res.status(200).json({ message: 'Announcement updated successfully', announcement });
  } catch (error) {
    console.error('Error updating announcement:', error);
    res.status(500).json({ message: 'Server error while updating announcement' });
  }
};

// @desc    Delete an announcement
// @route   DELETE /api/announcements/:id
// @access  Private (Admin, HOD, Teacher - original creator)
exports.deleteAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Find announcement
    const announcement = await Announcement.findById(id);
    
    if (!announcement) {
      return res.status(404).json({ message: 'Announcement not found' });
    }
    
    // Check permission - only allow creator, admins, or HODs to delete
    const isCreator = announcement.createdBy.toString() === req.user._id.toString();
    const canDelete = isCreator || req.user.role === 'admin' || req.user.role === 'HOD';
    
    if (!canDelete) {
      return res.status(403).json({ message: 'Not authorized to delete this announcement' });
    }
    
    await announcement.deleteOne();
    res.status(200).json({ message: 'Announcement deleted successfully' });
  } catch (error) {
    console.error('Error deleting announcement:', error);
    res.status(500).json({ message: 'Server error while deleting announcement' });
  }
};

// @desc    Toggle announcement active status
// @route   PATCH /api/announcements/:id/status
// @access  Private (Admin, HOD, Teacher - original creator)
exports.toggleAnnouncementStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;
    
    // Find announcement
    const announcement = await Announcement.findById(id);
    
    if (!announcement) {
      return res.status(404).json({ message: 'Announcement not found' });
    }
    
    // Check permission - only allow creator, admins, or HODs to toggle status
    const isCreator = announcement.createdBy.toString() === req.user._id.toString();
    const canToggle = isCreator || req.user.role === 'admin' || req.user.role === 'HOD';
    
    if (!canToggle) {
      return res.status(403).json({ message: 'Not authorized to toggle this announcement status' });
    }
    
    // Toggle the active status
    announcement.active = isActive !== undefined ? isActive : !announcement.active;
    await announcement.save();
    
    res.status(200).json({ 
      message: 'Announcement status updated successfully', 
      announcement: {
        _id: announcement._id,
        active: announcement.active
      }
    });
  } catch (error) {
    console.error('Error toggling announcement status:', error);
    res.status(500).json({ message: 'Server error while toggling announcement status' });
  }
};

// @desc    Get all announcements created by the logged-in user
// @route   GET /api/announcements/my-announcements
// @access  Private (HOD, Teacher)
exports.getMyAnnouncements = async (req, res) => {
  try {
    const announcements = await Announcement.find({ createdBy: req.user._id })
      .sort({ createdAt: -1 });
    
    res.status(200).json({ success: true, data: announcements });
  } catch (error) {
    console.error('Error fetching user-created announcements:', error);
    res.status(500).json({ message: 'Server error while fetching announcements' });
  }
};

// @desc    Mark all announcements as read for the current user
// @route   PUT /api/announcements/mark-all-read
// @access  Private
// This is a placeholder, actual implementation would depend on how "read" status is tracked.
// For now, it just returns a success message.
exports.markAllAnnouncementsAsRead = async (req, res) => {
    try {
        // This is a simplified implementation. In a real-world scenario,
        // you would have a separate model to track which user has read which announcement.
        // For example, a `UserAnnouncementStatus` collection.
        
        // For now, we'll just log the action and return success.
        console.log(`User ${req.user._id} marked all announcements as read.`);
        
        res.status(200).json({ message: 'All announcements marked as read' });
    } catch (error) {
        console.error('Error marking announcements as read:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = {
  createAnnouncement: exports.createAnnouncement,
  getAnnouncements: exports.getAnnouncements,
  getAnnouncementById: exports.getAnnouncementById,
  updateAnnouncement: exports.updateAnnouncement,
  deleteAnnouncement: exports.deleteAnnouncement,
  toggleAnnouncementStatus: exports.toggleAnnouncementStatus,
  markAllAsRead: exports.markAllAsRead,
  getMyAnnouncements: exports.getMyAnnouncements,
};
