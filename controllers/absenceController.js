const Absence = require('../models/Absence');
const User = require('../models/User');
const Timetable = require('../models/Timetable');
const Announcement = require('../models/Announcement');

// Report absence
exports.reportAbsence = async (req, res) => {
  try {
    const { classId, dateOfAbsence, reason } = req.body;
    const teacherId = req.user._id;
    const department = req.user.department;

    const absence = new Absence({
      teacher: teacherId,
      class: classId,
      department,
      dateOfAbsence,
      reason,
    });

    await absence.save();

    // Notify HOD
    const hod = await User.findOne({ department, role: 'hod' });
    if (hod) {
      await Announcement.create({
        title: 'Teacher Absence Reported',
        content: `Teacher ${req.user.name} has reported absence for class on ${dateOfAbsence}. Reason: ${reason}`,
        department,
        createdBy: req.user._id,
      });
    }

    res.status(201).json({ message: 'Absence reported successfully.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get absences for HOD's department
exports.getAbsences = async (req, res) => {
  try {
    const department = req.user.department;
    const absences = await Absence.find({ department }).populate('teacher class replacementTeacher');
    res.json(absences);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Assign replacement teacher
exports.assignReplacement = async (req, res) => {
  try {
    const { absenceId, replacementTeacherId } = req.body;

    const absence = await Absence.findById(absenceId);
    if (!absence) {
      return res.status(404).json({ message: 'Absence not found.' });
    }

    absence.replacementTeacher = replacementTeacherId;
    absence.status = 'Covered';
    await absence.save();

    // Update timetable temporarily
    const timetableEntry = await Timetable.findOne({
      teacher: absence.teacher,
      class: absence.class,
      dayOfWeek: new Date(absence.dateOfAbsence).toLocaleLowerCase(),
    });

    if (timetableEntry) {
      timetableEntry.teacher = replacementTeacherId;
      await timetableEntry.save();
    }

    // Notify replacement teacher
    const replacementTeacher = await User.findById(replacementTeacherId);
    if (replacementTeacher) {
      await Announcement.create({
        title: 'Class Replacement Assigned',
        content: `You have been assigned to replace ${absence.teacher.name} for class on ${absence.dateOfAbsence}.`,
        department: absence.department,
        createdBy: req.user._id,
      });
    }

    // Notify students
    await Announcement.create({
      title: 'Class Teacher Change',
      content: `The teacher for your class on ${absence.dateOfAbsence} has changed. New teacher: ${replacementTeacher.name}`,
      department: absence.department,
      createdBy: req.user._id,
    });

    res.json({ message: 'Replacement assigned successfully.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
      });
    }
  }
  return substitute;
};

// List absences for dashboard
exports.listAbsences = async (req, res) => {
  try {
    const absences = await Absence.find().populate('user class');
    res.json(absences);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Approve or reject absence request
exports.respondToAbsence = async (req, res) => {
  try {
    const { absenceId, status, notes } = req.body;
    const userId = req.user._id;
    const userRole = req.user.role;

    // Find the absence
    const absence = await Absence.findById(absenceId).populate('user class');
    if (!absence) {
      return res.status(404).json({ message: 'Absence request not found.' });
    }

    // Check authorization
    if (userRole === 'teacher') {
      // Teachers can only approve absences for their classes
      if (absence.class.teacher.toString() !== userId.toString()) {
        return res.status(403).json({ message: 'You are not authorized to respond to this absence request.' });
      }
    } else if (userRole === 'HOD') {
      // HODs can approve absences for classes in their department
      if (absence.class.HOD.toString() !== userId.toString()) {
        return res.status(403).json({ message: 'You are not authorized to respond to this absence request.' });
      }
    } else if (userRole !== 'admin') {
      return res.status(403).json({ message: 'You are not authorized to respond to absence requests.' });
    }

    // Update absence status
    absence.status = status;
    if (notes) {
      absence.notes = notes;
    }
    await absence.save();

    // If approved and it's a teacher absence, handle substitute assignment
    if (status === 'approved' && absence.role === 'teacher') {
      await exports.handleTeacherAbsence(absenceId);
    }

    // Notify the user who requested the absence
    const notificationMessage = {
      notification: {
        title: `Absence ${status}`,
        body: `Your absence request for ${absence.date.toLocaleDateString()} has been ${status.toLowerCase()}.`,
      },
      data: { absenceId: absence._id.toString() }
    };

    if (absence.user.deviceToken) {
      await sendFCMNotification({
        ...notificationMessage,
        token: absence.user.deviceToken
      });
    }

    await Notification.create({
      recipient: absence.user._id,
      type: status === 'approved' ? 'absence_approved' : 'absence_rejected',
      title: `Absence ${status}`,
      message: `Your absence request for ${absence.date.toLocaleDateString()} has been ${status.toLowerCase()}.`,
      data: { absenceId: absence._id }
    });

    res.status(200).json({ message: `Absence successfully ${status.toLowerCase()}.`, absence });
  } catch (error) {
    console.error('Error responding to absence:', error);
    res.status(500).json({ message: 'Server error while responding to absence.' });
  }
};

// Get absences for teacher's classes
exports.getAbsencesForTeacher = async (req, res) => {
  try {
    const userId = req.user._id;
    const userRole = req.user.role;

    let query = {};

    if (userRole === 'teacher') {
      // Get classes where user is the teacher
      const classes = await require('../models/Class').find({ teacher: userId }).select('_id');
      const classIds = classes.map(cls => cls._id);
      query.class = { $in: classIds };
    } else if (userRole === 'HOD') {
      // Get classes where user is the HOD
      const classes = await require('../models/Class').find({ HOD: userId }).select('_id');
      const classIds = classes.map(cls => cls._id);
      query.class = { $in: classIds };
    } else if (userRole === 'admin') {
      // Admin can see all absences
    } else {
      return res.status(403).json({ message: 'Unauthorized to view absences.' });
    }

    const absences = await Absence.find(query)
      .populate('user', 'name email')
      .populate('class', 'name')
      .sort({ createdAt: -1 });

    res.status(200).json(absences);
  } catch (error) {
    console.error('Error fetching absences:', error);
    res.status(500).json({ message: 'Server error while fetching absences.' });
  }
};
