const Absence = require('../models/Absence');
const User = require('../models/User');
const Timetable = require('../models/Timetable');
const Announcement = require('../models/Announcement');

// Get a single absence by ID
exports.getAbsenceById = async (req, res) => {
  try {
    const absence = await Absence.findById(req.params.id).populate('teacher student class replacementTeacher');
    if (!absence) {
      return res.status(404).json({ message: 'Absence not found.' });
    }
    res.json(absence);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Report absence
exports.reportAbsence = async (req, res) => {
  try {
    const { role, class: classId, reason, date, duration } = req.body;
    const userId = req.user._id;
    const department = req.user.department;

    // Validate required fields
    if (!role) {
      return res.status(400).json({ message: 'Role is required.' });
    }
    if (!classId) {
      return res.status(400).json({ message: 'Class is required.' });
    }
    if (!date) {
      return res.status(400).json({ message: 'Date of absence is required.' });
    }
    if (duration === undefined || duration === null || duration === '' || isNaN(Number(duration)) || Number(duration) <= 0) {
      return res.status(400).json({ message: 'Duration is required and must be a positive number.' });
    }

    const mongoose = require('mongoose');
    const absenceData = {
      reason,
      dateOfAbsence: date,
      duration: Number(duration), // Ensure duration is a number
      department,
      status: 'Pending',
      class: mongoose.Types.ObjectId(classId),
    };

    if (role === 'teacher') {
      absenceData.teacher = userId;
    } else if (role === 'student') {
      absenceData.student = userId;
    } else {
      return res.status(400).json({ message: 'Invalid role specified.' });
    }

    if (req.file) {
      absenceData.evidence = req.file.path;
    }

    const absence = new Absence(absenceData);
    await absence.save();

    // Notify HOD if a teacher is absent
    if (role === 'teacher') {
      const hod = await User.findOne({ department, role: 'HOD' });
      if (hod) {
        await Announcement.create({
          title: 'Teacher Absence Reported',
          message: `Teacher ${req.user.name} has reported absence from ${date} for ${duration} days. Reason: ${reason}`,
          department,
          targetRoles: ['HOD'],
          createdBy: req.user._id,
        });
      }
    }

    res.status(201).json({ message: 'Absence reported successfully.' });
  } catch (error) {
    console.error("Error reporting absence:", error);
    res.status(500).json({ message: 'Failed to report absence.', error: error.message });
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
      dayOfWeek: new Date(absence.dateOfAbsence).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase(),
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

// Get absences for a specific teacher
exports.getTeacherAbsences = async (req, res) => {
  try {
    const teacherId = req.user._id;
    const absences = await Absence.find({ teacher: teacherId })
      .populate('class', 'name')
      .populate('replacementTeacher', 'name')
      .sort({ createdAt: -1 });
    res.json(absences);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Respond to absence request (approve/reject)
exports.respondToAbsence = async (req, res) => {
  try {
    const { absenceId, status, notes } = req.body;
    const hodId = req.user._id;
    const department = req.user.department;

    const absence = await Absence.findById(absenceId);
    if (!absence) {
      return res.status(404).json({ message: 'Absence not found.' });
    }

    // Check if HOD is from the same department
    if (absence.department !== department) {
      return res.status(403).json({ message: 'You can only respond to absences in your department.' });
    }

    // Update absence status
    absence.status = status;
    if (notes) {
      absence.notes = notes;
    }

    await absence.save();

    res.json({ message: `Absence ${status.toLowerCase()} successfully.` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create absence (for both students and teachers)
exports.createAbsence = async (req, res) => {
  try {
    const { role, class: classId, reason, date, duration } = req.body;
    const userId = req.user._id;
    const department = req.user.department;

    // Handle file upload if evidence is provided
    let evidencePath = null;
    if (req.file) {
      evidencePath = req.file.path;
    }

    const absenceData = {
      teacher: role === 'teacher' ? userId : null,
      student: role === 'student' ? userId : null,
      class: classId || null,
      department,
      dateOfAbsence: date,
      reason,
      duration: parseInt(duration),
      evidence: evidencePath,
      status: 'Pending'
    };

    const absence = new Absence(absenceData);
    await absence.save();

    // Notify HOD
    const hod = await User.findOne({ department, role: 'hod' });
    if (hod) {
      await Announcement.create({
        title: `${role === 'teacher' ? 'Teacher' : 'Student'} Absence Reported`,
        content: `${role === 'teacher' ? 'Teacher' : 'Student'} ${req.user.name} has reported absence for ${date}. Reason: ${reason}`,
        department,
        createdBy: req.user._id,
      });
    }

    res.status(201).json({ message: 'Absence application submitted successfully.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getAbsenceById: exports.getAbsenceById,
  reportAbsence: exports.reportAbsence,
  getAbsences: exports.getAbsences,
  assignReplacement: exports.assignReplacement,
  getTeacherAbsences: exports.getTeacherAbsences,
  respondToAbsence: exports.respondToAbsence,
  createAbsence: exports.createAbsence,
};
