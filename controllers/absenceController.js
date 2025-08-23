const Absence = require('../models/Absence');
const Timetable = require('../models/Timetable');
const User = require('../models/User');
const Notification = require('../models/Notification');
const sendFCMNotification = require('../utils/sendFCMNotification');

// Student or teacher applies for absence
exports.applyAbsence = async (req, res) => {
  try {
    const { user, role, class: classId, reason, date, duration } = req.body;
    const evidence = req.file ? req.file.path : req.body.evidence;
    const absence = await Absence.create({ user, role, class: classId, reason, date, duration, evidence });
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
