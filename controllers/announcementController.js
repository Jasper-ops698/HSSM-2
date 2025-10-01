const Announcement = require('../models/Announcement');

const ALLOWED_TARGET_ROLES = ['student', 'teacher', 'HOD', 'admin', 'credit-controller', 'HSSM-provider'];
const ALLOWED_TARGET_SCOPES = ['department', 'global'];

const normalizeTargeting = (user, payload = {}, existing = {}) => {
  const rawRolesSource = payload.targetRoles !== undefined ? payload.targetRoles : existing.targetRoles;
  const rolesArray = Array.isArray(rawRolesSource)
    ? rawRolesSource
    : rawRolesSource
      ? [rawRolesSource]
      : [];
  const normalizedRoles = rolesArray
    .map(role => (typeof role === 'string' ? role.trim() : role))
    .filter(Boolean);

  if (!normalizedRoles.length) {
    return { error: 'A target group is required.', status: 400 };
  }

  if (normalizedRoles.length !== 1) {
    return { error: 'Select exactly one target group.', status: 400 };
  }

  const targetRole = normalizedRoles[0];

  if (!ALLOWED_TARGET_ROLES.includes(targetRole)) {
    return { error: 'Invalid target group specified.', status: 400 };
  }

  if (targetRole === 'admin' && user.role !== 'admin') {
    return { error: 'Only administrators can target admins.', status: 403 };
  }

  if (targetRole === 'HOD' && !['admin', 'HOD'].includes(user.role)) {
    return { error: 'Only administrators or HODs can target HODs.', status: 403 };
  }

  if (user.role === 'teacher' && ['HOD', 'admin'].includes(targetRole)) {
    return { error: 'Teachers cannot target that audience.', status: 403 };
  }

  if (['credit-controller', 'HSSM-provider'].includes(targetRole) && user.role !== 'admin') {
    return { error: 'Only administrators can target that audience.', status: 403 };
  }

  let targetScope = payload.targetScope !== undefined
    ? payload.targetScope
    : existing.targetScope;

  if (!ALLOWED_TARGET_SCOPES.includes(targetScope)) {
    targetScope = targetRole === 'HOD' ? 'global' : 'department';
  }

  if (targetScope === 'global' && !['admin', 'HOD'].includes(user.role)) {
    return { error: 'Only administrators or HODs can broadcast globally.', status: 403 };
  }

  if (targetRole === 'HOD' && targetScope !== 'global') {
    return { error: 'Announcements for HODs must target all HODs.', status: 400 };
  }

  if (targetRole === 'admin' && targetScope !== 'global') {
    return { error: 'Announcements for admins must target all admins.', status: 400 };
  }

  if (['credit-controller', 'HSSM-provider'].includes(targetRole)) {
    targetScope = 'global';
  }

  let department = payload.department !== undefined
    ? payload.department
    : existing.department;

  if (targetScope === 'department') {
    department = department || user.department;
    if (!department) {
      return { error: 'Department is required for department-scoped announcements.', status: 400 };
    }
  } else {
    department = null;
  }

  return {
    targetRoles: [targetRole],
    targetScope,
    department
  };
};

const buildAudienceFilters = (user) => {
  if (!user || user.role === 'admin') {
    return [];
  }

  const filters = [];
  const roleFilter = {
    $or: [
      { targetRoles: 'all' },
      { targetRoles: user.role }
    ]
  };

  const scopeConditions = [{ targetScope: 'global' }];

  if (user.department) {
    scopeConditions.push({
      $and: [
        { $or: [{ targetScope: 'department' }, { targetScope: { $exists: false } }] },
        { department: user.department }
      ]
    });

    scopeConditions.push({
      $and: [
        { targetScope: { $exists: false } },
        { department: user.department }
      ]
    });
  }

  scopeConditions.push({
    $and: [
      { targetScope: { $exists: false } },
      { $or: [{ department: { $exists: false } }, { department: null }] }
    ]
  });

  filters.push(roleFilter);
  filters.push({ $or: scopeConditions });

  return filters;
};

// @desc    Mark all announcements as read for the current student (soft delete)
// @route   PATCH /api/announcements/mark-all-read
// @access  Private (Student)
exports.markAllAnnouncementsAsRead = async (req, res) => {
  try {
    if (req.user.role !== 'student') {
      return res.status(403).json({ message: 'Only students can mark all announcements as read.' });
    }

    const userId = req.user._id;
    const currentDate = new Date();

    const andConditions = [
      { startDate: { $lte: currentDate } },
      { $or: [{ endDate: null }, { endDate: { $gte: currentDate } }] },
      ...buildAudienceFilters(req.user)
    ];

    const query = {
      active: true,
      ...(andConditions.length ? { $and: andConditions } : {})
    };

    await Announcement.updateMany(
      query,
      { $addToSet: { readBy: userId } }
    );

    res.status(200).json({ message: 'All announcements marked as read for this student.' });
  } catch (error) {
    console.error('Error marking all announcements as read:', error);
    res.status(500).json({ message: 'Server error while marking announcements as read.' });
  }
};

// @desc    Create a new announcement
// @route   POST /api/announcements
// @access  Private (Admin, HOD, Teacher)
exports.createAnnouncement = async (req, res) => {
  try {
    const { title, message, content, department, targetRoles, priority, startDate, endDate, isActive, active, targetClass, targetAudience, targetScope } = req.body;
    
    // Handle field name differences (frontend uses 'content', backend uses 'message')
    const announcementMessage = message || content;
    
    // Basic validation
    if (!title || !announcementMessage) {
      return res.status(400).json({ message: 'Title and message are required' });
    }

    const targeting = normalizeTargeting(
      req.user,
      { targetRoles, targetScope, department }
    );

    if (targeting.error) {
      return res.status(targeting.status).json({ message: targeting.error });
    }

    // Create announcement
    const announcement = new Announcement({
      title,
      message: announcementMessage,
      department: targeting.department,
      targetRoles: targeting.targetRoles,
      targetScope: targeting.targetScope,
      targetClass: targetClass || undefined,
      targetAudience: targetAudience || 'all',
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
    const { active, priority, department, targetScope } = req.query;

    const query = {};
    const andConditions = [];

    if (req.user.role !== 'admin') {
      const audienceFilters = buildAudienceFilters(req.user);
      if (audienceFilters.length) {
        andConditions.push(...audienceFilters);
      }
      query.active = active === 'false' ? false : true;
    } else {
      if (active === 'false') {
        query.active = false;
      } else if (active === 'all') {
        // no active filter
      } else {
        query.active = true;
      }
    }

    if (priority && ['low', 'medium', 'high'].includes(priority)) {
      query.priority = priority;
    }

    if (department && req.user.role === 'admin') {
      query.department = department;
    }

    if (targetScope && ALLOWED_TARGET_SCOPES.includes(targetScope)) {
      query.targetScope = targetScope;
    }

    const currentDate = new Date();
    andConditions.push({ startDate: { $lte: currentDate } });
    andConditions.push({ $or: [{ endDate: null }, { endDate: { $gte: currentDate } }] });

    if (andConditions.length) {
      query.$and = andConditions;
    }

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
    if (updates.message !== undefined) {
      announcement.message = updates.message;
    }
    if (updates.isActive !== undefined) {
      announcement.active = updates.isActive;
    }

    const targetingFields = ['targetRoles', 'targetScope', 'department'].some(field => updates[field] !== undefined);
    if (targetingFields) {
      const targeting = normalizeTargeting(req.user, updates, {
        targetRoles: announcement.targetRoles,
        targetScope: announcement.targetScope || (announcement.department ? 'department' : 'global'),
        department: announcement.department
      });

      if (targeting.error) {
        return res.status(targeting.status).json({ message: targeting.error });
      }

      announcement.targetRoles = targeting.targetRoles;
      announcement.targetScope = targeting.targetScope;
      announcement.department = targeting.department;
    }

    const allowedUpdates = ['title', 'active', 'priority', 'endDate', 'startDate'];
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

// @desc    Delete all announcements for the current user
// @route   DELETE /api/announcements/delete-all
// @access  Private
exports.deleteAllAnnouncements = async (req, res) => {
  try {
    // Option 1: Delete all announcements (admin only)
    // await Announcement.deleteMany({});

    // Option 2: Delete all announcements created by the current user
    await Announcement.deleteMany({ createdBy: req.user._id });
    res.status(200).json({ message: 'All announcements deleted' });
  } catch (error) {
    console.error('Error deleting announcements:', error);
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
  markAllAnnouncementsAsRead: exports.markAllAnnouncementsAsRead,
  getMyAnnouncements: exports.getMyAnnouncements,
  deleteAllAnnouncements: exports.deleteAllAnnouncements,
};
