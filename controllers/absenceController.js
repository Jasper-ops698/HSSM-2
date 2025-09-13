const Absence = require('../models/Absence');
const Timetable = require('../models/Timetable');
const User = require('../models/User');
const Notification = require('../models/Notification');
const sendFCMNotification = require('../utils/sendFCMNotification');

// Student or teacher applies for absence
exports.applyAbsence = async (req, res) => {
  try {
    const { role, class: classId, reason, date, duration } = req.body;
    const evidence = req.file ? req.file.path : req.body.evidence;
    const absence = await Absence.create({ user: req.user._id, role, class: classId, reason, date, duration, evidence });
    // Notify HOD/teacher/admin
    const classObj = await require('../models/Class').findById(classId).populate('HOD');
    const recipients = [];
    if (classObj?.HOD) recipients.push(classObj.HOD);
    if (role === 'student') {
      // Notify class teacher(s)
      const timetable = await Timetable.findOne({ class: classId });
      if (timetable) {
        timetable.entries.forEach(entry => {
          if (entry.teacher) recipients.push(entry.teacher);
        });
      }
    }
    // Always notify admin
    const admins = await User.find({ role: 'admin' });
    recipients.push(...admins);
    // Send notification to each recipient
    for (const recipient of recipients) {
      await Notification.create({
        recipient: recipient._id,
        type: role === 'student' ? 'student_absence' : 'teacher_absence',
        title: `${role.charAt(0).toUpperCase() + role.slice(1)} Absence Application`,
        message: `${role.charAt(0).toUpperCase() + role.slice(1)} submitted an absence application for class ${classObj?.name || ''}.`,
        data: { absenceId: absence._id }
      });
      if (recipient.deviceToken) {
        await sendFCMNotification({
          token: recipient.deviceToken,
          notification: {
            title: `${role.charAt(0).toUpperCase() + role.slice(1)} Absence Application`,
            body: `${role.charAt(0).toUpperCase() + role.slice(1)} submitted an absence application for class ${classObj?.name || ''}.`
          },
          data: { absenceId: absence._id.toString() }
        });
      }
    }
    res.status(201).json(absence);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// If teacher is absent, auto-assign substitute
exports.handleTeacherAbsence = async (absenceId) => {
  const absence = await Absence.findById(absenceId);
  if (!absence || absence.role !== 'teacher') return;
  const timetable = await Timetable.findOne({ class: absence.class });
  if (!timetable) return;
  // Find substitute teacher (any available teacher not absent)
  const absentTeacherId = absence.user;
  const allTeachers = await User.find({ role: 'teacher', isDisabled: false });
  const absentTeachers = await Absence.find({ role: 'teacher', date: absence.date }).distinct('user');
  const availableTeachers = allTeachers.filter(t => !absentTeachers.includes(t._id.toString()) && t._id.toString() !== absentTeacherId.toString());
  if (availableTeachers.length === 0) return;
  const substitute = availableTeachers[0]; // Simple selection, can be improved
  // Update timetable
  timetable.entries.forEach(entry => {
    if (entry.teacher.toString() === absentTeacherId.toString() && entry.day === absence.date.toLocaleString('en-US', { weekday: 'long' })) {
      entry.substituteTeacher = substitute._id;
    }
  });
  await timetable.save();
  // Notify substitute, HOD, students
  const classObj = await require('../models/Class').findById(absence.class).populate('HOD');
  const recipients = [];
  if (classObj?.HOD) recipients.push(classObj.HOD);
  if (substitute) recipients.push(substitute);
  // Notify all students in the class
  if (classObj?.students) recipients.push(...classObj.students);
  // Always notify admin
  const admins = await User.find({ role: 'admin' });
  recipients.push(...admins);
  for (const recipient of recipients) {
    await Notification.create({
      recipient: recipient._id,
      type: 'substitute_assigned',
      title: 'Substitute Teacher Assigned',
      message: `Substitute teacher ${substitute?.name || ''} assigned for class ${classObj?.name || ''}.`,
      data: { absenceId: absence._id, substituteId: substitute?._id }
    });
    if (recipient.deviceToken) {
      await sendFCMNotification({
        token: recipient.deviceToken,
        notification: {
          title: 'Substitute Teacher Assigned',
          body: `Substitute teacher ${substitute?.name || ''} assigned for class ${classObj?.name || ''}.`
        },
        data: { absenceId: absence._id.toString(), substituteId: substitute?._id.toString() }
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
