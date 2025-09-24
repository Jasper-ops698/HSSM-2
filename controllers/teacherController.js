const Class = require('../models/Class');
const Absence = require('../models/Absence');
const User = require('../models/User');
const Notification = require('../models/Notification');
const Announcement = require('../models/Announcement');
const Timetable = require('../models/Timetable');
const Attendance = require('../models/Attendance');

// @desc    Teacher creates a new class
// @route   POST /api/teacher/class
// @access  Private/Teacher
exports.createClass = async (req, res) => {
  try {
    const { name, description, creditsRequired, image, timetable } = req.body;
    const teacher = req.user;

    if (!name || !description || !creditsRequired) {
      return res.status(400).json({ message: 'Name, description, and credits required are mandatory.' });
    }

    // Find the HOD for the teacher's department
    const hod = await User.findOne({ role: 'HOD', department: teacher.department });

    const newClass = new Class({
      name,
      description,
      creditsRequired,
      image,
      timetable,
      teacher: teacher._id,
      department: teacher.department,
      HOD: hod ? hod._id : null, // Assign HOD if found
    });

    await newClass.save();
    res.status(201).json({ message: 'Class created successfully.', class: newClass });
  } catch (error) {
    console.error('Error creating class:', error);
    res.status(500).json({ message: 'Server error while creating class.' });
  }
};

// @desc    Teacher updates their own class
// @route   PUT /api/teacher/class/:id
// @access  Private/Teacher
exports.updateClass = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const teacherId = req.user._id;

    const targetClass = await Class.findById(id);

    if (!targetClass) {
      return res.status(404).json({ message: 'Class not found.' });
    }

    // Ensure the teacher owns the class
    if (targetClass.teacher.toString() !== teacherId.toString()) {
      return res.status(403).json({ message: 'You are not authorized to update this class.' });
    }

    // Update fields
    Object.keys(updates).forEach(key => {
      // Prevent changing teacher, department, or HOD
      if (key !== 'teacher' && key !== 'department' && key !== 'HOD') {
        targetClass[key] = updates[key];
      }
    });

    await targetClass.save();
    res.status(200).json({ message: 'Class updated successfully.', class: targetClass });
  } catch (error) {
    console.error('Error updating class:', error);
    res.status(500).json({ message: 'Server error while updating class.' });
  }
};

// @desc    Teacher deletes their own class
// @route   DELETE /api/teacher/class/:id
// @access  Private/Teacher
exports.deleteClass = async (req, res) => {
  try {
    const { id } = req.params;
    const teacherId = req.user._id;

    const targetClass = await Class.findById(id);

    if (!targetClass) {
      return res.status(404).json({ message: 'Class not found.' });
    }

    if (targetClass.teacher.toString() !== teacherId.toString()) {
      return res.status(403).json({ message: 'You are not authorized to delete this class.' });
    }

    // Add a check: do not delete if students are enrolled
    if (targetClass.enrolledStudents && targetClass.enrolledStudents.length > 0) {
      return res.status(400).json({ message: 'Cannot delete class with enrolled students. Please remove students first.' });
    }

    await targetClass.deleteOne();
    res.status(200).json({ message: 'Class deleted successfully.' });
  } catch (error) {
    console.error('Error deleting class:', error);
    res.status(500).json({ message: 'Server error while deleting class.' });
  }
};

// @desc    Get all classes for the logged-in teacher
// @route   GET /api/teacher/classes
// @access  Private/Teacher
exports.getTeacherClasses = async (req, res) => {
  try {
    const teacherId = req.user._id;
    const classes = await Class.find({ teacher: teacherId }).populate('enrolledStudents', 'name email');
    res.status(200).json(classes);
  } catch (error) {
    console.error('Error fetching teacher classes:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};


// @desc    Get data for the teacher dashboard
// @route   GET /api/teacher/dashboard
// @access  Private (Teacher)
exports.getDashboardData = async (req, res) => {
  try {
    const teacherId = req.user.id;

    // Find classes taught by the teacher
    const classes = await Class.find({ teacher: teacherId });

    const totalClasses = classes.length;

    // Calculate total unique students
    const studentIds = new Set();
    classes.forEach(c => {
      if (c.enrolledStudents) {
        c.enrolledStudents.forEach(studentId => {
          studentIds.add(studentId.toString());
        });
      }
    });
    const totalStudents = studentIds.size;

    // For recent activity, you could fetch recent enrollments or announcements
    // This is a placeholder
    const recentActivity = [
      { description: "New student enrolled in Advanced Physics", timestamp: new Date() },
      { description: "Class 'Intro to Chemistry' was updated", timestamp: new Date() }
    ];

    // Get student absences for classes taught by this teacher
    const studentAbsences = await Absence.find({
      class: { $in: classes.map(c => c._id) },
      student: { $ne: null }
    })
      .populate('student', 'name email')
      .populate('class', 'name')
      .sort({ dateOfAbsence: -1 });

    // Get teacher's own absences
    const teacherAbsences = await Absence.find({
      teacher: teacherId
    })
      .populate('class', 'name')
      .sort({ dateOfAbsence: -1 });

    res.json({
      totalClasses,
      totalStudents,
      recentActivity,
      absences: studentAbsences,
      teacherAbsences
    });
  } catch (error) {
    console.error('Error fetching teacher dashboard data:', error);
    res.status(500).json({ msg: 'Server Error' });
  }
};

// @desc    Mark student attendance
// @route   POST /api/teacher/attendance
// @access  Private (Teacher)
exports.markAttendance = async (req, res) => {
  const { classId, studentId, date, status } = req.body;

  try {
    // Validate inputs
    if (!classId || !studentId || !date || !status) {
      return res.status(400).json({ message: 'classId, studentId, date and status are required.' });
    }

    // Ensure the teacher owns the class before allowing attendance marking
    const targetClass = await Class.findById(classId);
    if (!targetClass) return res.status(404).json({ message: 'Class not found.' });
    if (targetClass.teacher && targetClass.teacher.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You are not authorized to mark attendance for this class.' });
    }

  // Parse date and normalize to UTC date (midnight UTC) to avoid timezone shifts
  const parsedInputDate = new Date(date);
  if (isNaN(parsedInputDate.getTime())) return res.status(400).json({ message: 'Invalid date format.' });
  const parsedDate = new Date(Date.UTC(parsedInputDate.getUTCFullYear(), parsedInputDate.getUTCMonth(), parsedInputDate.getUTCDate()));

    // Optional: ensure teacher is marking during a scheduled session for this class
    // We'll allow marking if a timetable entry exists for the class on that day and current time is within +/- 30 minutes of start-end
  // Use epoch ms for UTC-consistent comparisons
  const nowMs = Date.now();
    try {
      // Use UTC day to determine timetable day-of-week consistently across timezones
      const WEEKDAY_KEYS = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
      const dayKey = WEEKDAY_KEYS[parsedDate.getUTCDay()];
      const timetableEntry = await Timetable.findOne({
        teacher: req.user._id,
        class: classId,
        dayOfWeek: dayKey,
        startDate: { $lte: parsedDate },
        $or: [{ endDate: null }, { endDate: { $gte: parsedDate } }]
      });
      // If a timetable entry exists, check time window
      if (timetableEntry) {
        // Parse timetable start/end times which are stored as strings like '09:00' or '09:00:00'
        // Parse times into UTC-based Date objects on the same UTC date
        const parseTimeUTC = (timeStr, baseDateUTC) => {
          const parts = timeStr.split(':').map(p => parseInt(p, 10));
          return new Date(Date.UTC(baseDateUTC.getUTCFullYear(), baseDateUTC.getUTCMonth(), baseDateUTC.getUTCDate(), parts[0] || 0, parts[1] || 0, parts[2] || 0));
        };
        const start = parseTimeUTC(timetableEntry.startTime || '00:00', parsedDate);
        const end = parseTimeUTC(timetableEntry.endTime || '00:00', parsedDate);
        // Allow 30-minute pre and post window
        const windowStart = new Date(start.getTime() - 30 * 60 * 1000);
        const windowEnd = new Date(end.getTime() + 30 * 60 * 1000);
        if (nowMs < windowStart.getTime() || nowMs > windowEnd.getTime()) {
          return res.status(403).json({ message: 'Attendance can only be marked within the scheduled session time window.' });
        }
      }
    } catch (e) {
      // If timetable lookup fails, we won't block marking; just log
      console.warn('Timetable check failed:', e.message || e);
    }

  // Normalize date to UTC start-of-day for session identity
  const sessionDate = new Date(Date.UTC(parsedDate.getUTCFullYear(), parsedDate.getUTCMonth(), parsedDate.getUTCDate()));

    // Upsert an Attendance record for the session (present/absent/etc.)
    // Find by exact UTC dateOfSession
    const existingAttendance = await Attendance.findOne({
      class: classId,
      student: studentId,
      dateOfSession: sessionDate,
    });

    if (existingAttendance) {
      existingAttendance.status = status;
      existingAttendance.teacher = targetClass.teacher || req.user._id;
      existingAttendance.department = targetClass.department || req.user.department || existingAttendance.department || 'General';
      existingAttendance.markedBy = req.user._id;
      await existingAttendance.save();
      return res.status(200).json(existingAttendance);
    }

    const created = new Attendance({
      class: classId,
      student: studentId,
      teacher: targetClass.teacher || req.user._id,
      department: targetClass.department || req.user.department || 'General',
      dateOfSession: sessionDate,
      status,
      markedBy: req.user._id,
      notes: status === 'absent' ? 'Marked absent by teacher' : undefined
    });

    await created.save();
    return res.status(201).json(created);
  } catch (error) {
    console.error('Error marking attendance:', error);
    res.status(500).json({ msg: 'Server Error' });
  }
};

// Bulk attendance marking handler
exports.bulkMarkAttendance = async (req, res) => {
  try {
    const { classId, date, attendance } = req.body; // attendance: [{ studentId, status }, ...]
    if (!classId || !date || !Array.isArray(attendance)) return res.status(400).json({ message: 'classId, date and attendance array are required.' });

    // Ensure teacher owns class
    const targetClass = await Class.findById(classId);
    if (!targetClass) return res.status(404).json({ message: 'Class not found.' });
    if (targetClass.teacher && targetClass.teacher.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You are not authorized to mark attendance for this class.' });
    }

    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) return res.status(400).json({ message: 'Invalid date format.' });

    // Optional timetable session check (reuse logic from markAttendance)
  // Use epoch ms for UTC-consistent comparisons in bulk handler
  const nowMs = Date.now();
    try {
      const WEEKDAY_KEYS = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
      const dayKey = WEEKDAY_KEYS[parsedDate.getDay()];
      const timetableEntry = await Timetable.findOne({
        teacher: req.user._id,
        class: classId,
        dayOfWeek: dayKey,
        startDate: { $lte: parsedDate },
        $or: [{ endDate: null }, { endDate: { $gte: parsedDate } }]
      });
      if (timetableEntry) {
        const parseTime = (timeStr, baseDate) => {
          const parts = timeStr.split(':').map(p => parseInt(p, 10));
          const d = new Date(baseDate);
          d.setHours(parts[0] || 0, parts[1] || 0, parts[2] || 0, 0);
          return d;
        };
        const start = parseTime(timetableEntry.startTime, parsedDate);
        const end = parseTime(timetableEntry.endTime, parsedDate);
        const windowStart = new Date(start.getTime() - 30 * 60 * 1000);
        const windowEnd = new Date(end.getTime() + 30 * 60 * 1000);
        if (nowMs < windowStart.getTime() || nowMs > windowEnd.getTime()) {
          return res.status(403).json({ message: 'Attendance can only be marked within the scheduled session time window.' });
        }
      }
    } catch (e) {
      console.warn('Timetable check failed (bulk):', e.message || e);
    }

    const results = { created: 0, updated: 0, errors: [] };

    // Process each attendance record sequentially
    for (const item of attendance) {
      try {
        const { studentId, status } = item;
        if (!studentId || !status) { results.errors.push({ item, message: 'Missing studentId or status' }); continue; }

        const sessionDate = new Date(parsedDate);
        sessionDate.setHours(0,0,0,0);

        const existing = await Attendance.findOne({ class: classId, student: studentId, dateOfSession: sessionDate });
        if (existing) {
          existing.status = status;
          existing.teacher = targetClass.teacher || req.user._id;
          existing.department = targetClass.department || req.user.department || existing.department || 'General';
          existing.markedBy = req.user._id;
          await existing.save();
          results.updated++;
        } else {
          const created = new Attendance({
            class: classId,
            student: studentId,
            teacher: targetClass.teacher || req.user._id,
            department: targetClass.department || req.user.department || 'General',
            dateOfSession: sessionDate,
            status,
            markedBy: req.user._id,
            notes: status === 'absent' ? 'Marked absent by teacher' : undefined
          });
          await created.save();
          results.created++;
        }
      } catch (e) {
        results.errors.push({ item, message: e.message || String(e) });
      }
    }

    return res.status(200).json({ message: 'Bulk attendance processed.', results });
  } catch (error) {
    console.error('Error in bulkMarkAttendance:', error);
    return res.status(500).json({ message: 'Server error processing bulk attendance.' });
  }
};

// @desc    Add a venue announcement for a class
// @route   POST /api/teacher/class/:id/venue-announcement
// @access  Private (Teacher)
exports.addVenueAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;
    const { venue, message } = req.body;
    const teacherId = req.user._id;

    if (!venue) {
      return res.status(400).json({ message: 'Venue is required.' });
    }

    const targetClass = await Class.findById(id);

    if (!targetClass) {
      return res.status(404).json({ message: 'Class not found.' });
    }

    // Ensure the teacher owns the class
    if (targetClass.teacher.toString() !== teacherId.toString()) {
      return res.status(403).json({ message: 'You are not authorized to update this class.' });
    }

    // Add new venue announcement
    targetClass.venueAnnouncements.push({
      venue,
      message: message || '',
      date: new Date(),
      active: true
    });

    await targetClass.save();

    // Notify enrolled students
    if (targetClass.enrolledStudents && targetClass.enrolledStudents.length > 0) {
      const notifications = targetClass.enrolledStudents.map(studentId => ({
        recipient: studentId,
        type: 'timetable_update',
        title: 'Class Venue Update',
        message: `Venue for ${targetClass.name} has been updated to ${venue}`,
        data: { classId: targetClass._id }
      }));

      if (notifications.length > 0) {
        await Notification.insertMany(notifications);
      }
    }

    res.status(200).json({ 
      message: 'Venue announcement added successfully.', 
      announcement: targetClass.venueAnnouncements[targetClass.venueAnnouncements.length - 1] 
    });
  } catch (error) {
    console.error('Error adding venue announcement:', error);
    res.status(500).json({ message: 'Server error while adding venue announcement.' });
  }
};

// @desc    Update a venue announcement
// @route   PUT /api/teacher/class/:id/venue-announcement/:announcementId
// @access  Private (Teacher)
exports.updateVenueAnnouncement = async (req, res) => {
  try {
    const { id, announcementId } = req.params;
    const { venue, message, active } = req.body;
    const teacherId = req.user._id;

    const targetClass = await Class.findById(id);

    if (!targetClass) {
      return res.status(404).json({ message: 'Class not found.' });
    }

    // Ensure the teacher owns the class
    if (targetClass.teacher.toString() !== teacherId.toString()) {
      return res.status(403).json({ message: 'You are not authorized to update this class.' });
    }

    // Find and update the announcement
    const announcement = targetClass.venueAnnouncements.id(announcementId);
    if (!announcement) {
      return res.status(404).json({ message: 'Announcement not found.' });
    }

    if (venue) announcement.venue = venue;
    if (message !== undefined) announcement.message = message;
    if (active !== undefined) announcement.active = active;

    await targetClass.save();

    // If activating/updating an active announcement, notify students
    if (active && targetClass.enrolledStudents && targetClass.enrolledStudents.length > 0) {
      const notifications = targetClass.enrolledStudents.map(studentId => ({
        recipient: studentId,
        type: 'timetable_update',
        title: 'Class Venue Update',
        message: `Venue for ${targetClass.name} has been updated to ${venue || announcement.venue}`,
        data: { classId: targetClass._id }
      }));

      if (notifications.length > 0) {
        await Notification.insertMany(notifications);
      }
    }

    res.status(200).json({ 
      message: 'Venue announcement updated successfully.', 
      announcement 
    });
  } catch (error) {
    console.error('Error updating venue announcement:', error);
    res.status(500).json({ message: 'Server error while updating venue announcement.' });
  }
};

// @desc    Get venue announcements for a class
// @route   GET /api/teacher/class/:id/venue-announcements
// @access  Private (Teacher)
exports.getVenueAnnouncements = async (req, res) => {
  try {
    const { id } = req.params;
    const teacherId = req.user._id;

    const targetClass = await Class.findById(id);

    if (!targetClass) {
      return res.status(404).json({ message: 'Class not found.' });
    }

    // Ensure the teacher owns the class
    if (targetClass.teacher.toString() !== teacherId.toString()) {
      return res.status(403).json({ message: 'You are not authorized to view this class.' });
    }

    res.status(200).json(targetClass.venueAnnouncements);
  } catch (error) {
    console.error('Error getting venue announcements:', error);
    res.status(500).json({ message: 'Server error while fetching venue announcements.' });
  }
};

// @desc    Get all students in the teacher's department
// @route   GET /api/teacher/students
// @access  Private/Teacher
exports.getStudents = async (req, res) => {
  try {
    const teacher = req.user;

    // Get all students in the same department as the teacher
    const students = await User.find({ 
      role: 'student', 
      department: teacher.department 
    }).select('name email _id');

    res.status(200).json(students);
  } catch (error) {
    console.error('Error getting students:', error);
    res.status(500).json({ message: 'Server error while fetching students.' });
  }
};

// @desc    Create an announcement for the HOD
// @route   POST /api/teacher/announcement
// @access  Private/Teacher
exports.createAnnouncement = async (req, res) => {
  try {
    const { title, message } = req.body;
    const teacher = req.user;

    // Find the HOD of the teacher's department
    const hod = await User.findOne({ role: 'HOD', department: teacher.department });

    if (!hod) {
      return res.status(404).json({ message: 'HOD not found for this department.' });
    }

    // Create the announcement
    const announcement = new Announcement({
      title,
      message,
      department: teacher.department,
      createdBy: teacher._id,
      targetRoles: ['HOD'],
    });
    await announcement.save();

    // Create a notification for the HOD
    const notification = new Notification({
      recipient: hod._id,
      sender: teacher._id,
      type: 'new_announcement',
      message: `New announcement from ${teacher.name}: ${title}`,
      related_announcement: announcement._id,
    });
    await notification.save();

    res.status(201).json({ message: 'Announcement sent to HOD successfully.', announcement });
  } catch (error) {
    console.error('Error creating announcement:', error);
    res.status(500).json({ message: 'Server error while creating announcement.' });
  }
};

module.exports = {
  createClass: exports.createClass,
  updateClass: exports.updateClass,
  deleteClass: exports.deleteClass,
  getTeacherClasses: exports.getTeacherClasses,
  getDashboardData: exports.getDashboardData,
  markAttendance: exports.markAttendance,
  bulkMarkAttendance: exports.bulkMarkAttendance,
  addVenueAnnouncement: exports.addVenueAnnouncement,
  updateVenueAnnouncement: exports.updateVenueAnnouncement,
  getVenueAnnouncements: exports.getVenueAnnouncements,
  getStudents: exports.getStudents,
  createAnnouncement: exports.createAnnouncement,
};
