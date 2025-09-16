const Timetable = require('../models/Timetable');
const User = require('../models/User');
const Class = require('../models/Class');
const xlsx = require('xlsx');
const VENUES = require('../config/venues');
const NotificationService = require('../services/notificationService');

// Helper function to check for venue conflicts
async function checkVenueConflict(venue, day, startTime, endTime, excludeId = null) {
  const query = {
    venue: venue,
    dayOfWeek: day,
    $or: [
      { startTime: { $lt: endTime }, endTime: { $gt: startTime } }
    ]
  };

  if (excludeId) {
    query._id = { $ne: excludeId };
  }

  const conflict = await Timetable.findOne(query);
  if (conflict) {
    throw new Error(`Booking conflict: Venue "${venue}" is already booked from ${conflict.startTime} to ${conflict.endTime} on ${day}.`);
  }
}

exports.uploadTimetable = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded.' });
  }

  const department = req.user.department;
  if (!department) {
    return res.status(400).json({ message: 'User department not found.' });
  }

  try {
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(worksheet);

    const timetableData = []; // Collect data for auto-generation

    for (const row of data) {
      const { subject, teacherEmail, dayOfWeek, startTime, endTime, venue } = row;

      if (!subject || !teacherEmail || !dayOfWeek || !startTime || !endTime || !venue) {
        continue; // Skip incomplete rows
      }

      // Validate venue
      if (!VENUES.includes(venue)) {
        return res.status(400).json({ message: `Invalid venue: ${venue}` });
      }

      // Check for conflicts
      await checkVenueConflict(venue, dayOfWeek, startTime, endTime);

      const teacher = await User.findOne({ email: teacherEmail });
      if (!teacher) {
        return res.status(400).json({ message: `Teacher with email ${teacherEmail} not found.` });
      }

      const newEntry = new Timetable({
        subject,
        teacher: teacher._id,
        department,
        dayOfWeek,
        startTime,
        endTime,
        venue,
      });

      await newEntry.save();

      // Collect data for auto-generation
      timetableData.push({
        subject,
        teacherEmail,
        teacher: teacher._id,
        dayOfWeek,
        startTime,
        endTime,
        venue
      });
    }

    // Auto-generate classes from the uploaded timetable
    try {
      const generatedClasses = await autoGenerateClassesFromTimetable(timetableData, department);
      console.log(`Successfully auto-generated ${generatedClasses.length} classes`);
    } catch (autoGenError) {
      console.error('Error during auto-generation:', autoGenError);
      // Don't fail the entire upload if auto-generation fails
    }

    // Send notifications to students and teachers in the department
    await NotificationService.notifyTimetableUpdate(department, req.user.name || req.user.email);

    res.status(201).json({ message: 'Timetable uploaded and processed successfully.' });

    // Send notifications to students and teachers in the department
    await NotificationService.notifyTimetableUpdate(department, req.user.name || req.user.email);

    res.status(201).json({ message: 'Timetable uploaded and processed successfully.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Helper function to calculate credits based on class sessions
function calculateCreditsFromTimetable(subjectTimetable) {
  // Count unique days the subject is taught
  const uniqueDays = new Set(subjectTimetable.map(entry => entry.dayOfWeek));
  return uniqueDays.size;
}

// Helper function to auto-generate classes from timetable data
async function autoGenerateClassesFromTimetable(timetableData, department) {
  try {
    console.log('Starting auto-generation of classes from timetable...');

    // Group timetable entries by subject
    const subjectsMap = new Map();

    for (const entry of timetableData) {
      if (!subjectsMap.has(entry.subject)) {
        subjectsMap.set(entry.subject, {
          subject: entry.subject,
          teacherEmail: entry.teacherEmail,
          teacher: entry.teacher,
          department: department,
          timetable: []
        });
      }
      subjectsMap.get(entry.subject).timetable.push({
        day: entry.dayOfWeek,
        startTime: entry.startTime,
        endTime: entry.endTime,
        venue: entry.venue
      });
    }

    const generatedClasses = [];

    // Create classes for each subject
    for (const [subjectName, subjectData] of subjectsMap) {
      try {
        // Calculate credits based on number of unique days
        const creditsRequired = calculateCreditsFromTimetable(subjectData.timetable);

        // Check if class already exists
        const existingClass = await Class.findOne({
          name: subjectName,
          department: department,
          teacher: subjectData.teacher
        });

        if (existingClass) {
          // Update existing class with new timetable
          existingClass.timetable = subjectData.timetable;
          existingClass.creditsRequired = creditsRequired;
          await existingClass.save();
          console.log(`Updated existing class: ${subjectName}`);
        } else {
          // Find HOD for the department
          const hod = await User.findOne({ role: 'HOD', department: department });

          // Create new class
          const newClass = new Class({
            name: subjectName,
            description: `Auto-generated class for ${subjectName} in ${department} department.`,
            teacher: subjectData.teacher,
            department: department,
            creditsRequired: creditsRequired,
            timetable: subjectData.timetable,
            HOD: hod ? hod._id : null,
            enrolledStudents: [],
            autoGenerated: true, // Mark as auto-generated
          });

          await newClass.save();
          generatedClasses.push(newClass);
          console.log(`Created new class: ${subjectName} (${creditsRequired} credits)`);
        }
      } catch (error) {
        console.error(`Error creating/updating class for ${subjectName}:`, error);
      }
    }

    console.log(`Auto-generated ${generatedClasses.length} classes from timetable`);
    return generatedClasses;
  } catch (error) {
    console.error('Error in auto-generating classes:', error);
    throw error;
  }
}

exports.getTimetable = async (req, res) => {
  try {
    const timetable = await Timetable.find().populate('teacher', 'name');
    res.json(timetable);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch timetable.' });
  }
};

// Get timetable for a specific student (based on their enrolled classes)
exports.getStudentTimetable = async (req, res) => {
  try {
    const studentId = req.user.id;
    const studentDepartment = req.user.department;

    // Find classes the student is enrolled in
    const enrolledClasses = await Class.find({
      students: studentId,
      status: 'Approved'
    }).select('name subject');

    // Get subjects from enrolled classes
    const enrolledSubjects = enrolledClasses.map(cls => cls.subject || cls.name);

    // Find timetable entries for these subjects in the student's department
    const timetable = await Timetable.find({
      department: studentDepartment,
      subject: { $in: enrolledSubjects }
    }).populate('teacher', 'name email');

    // Group by day for better display
    const groupedTimetable = timetable.reduce((acc, entry) => {
      if (!acc[entry.dayOfWeek]) {
        acc[entry.dayOfWeek] = [];
      }
      acc[entry.dayOfWeek].push(entry);
      return acc;
    }, {});

    // Sort each day's entries by start time
    Object.keys(groupedTimetable).forEach(day => {
      groupedTimetable[day].sort((a, b) => a.startTime.localeCompare(b.startTime));
    });

    res.json({
      timetable: groupedTimetable,
      enrolledClasses: enrolledClasses.length,
      totalEntries: timetable.length
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch student timetable.' });
  }
};

// Get timetable for a specific teacher
exports.getTeacherTimetable = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const teacherDepartment = req.user.department;

    // Find timetable entries for this teacher
    const timetable = await Timetable.find({
      teacher: teacherId,
      department: teacherDepartment
    }).populate('teacher', 'name email');

    // Group by day for better display
    const groupedTimetable = timetable.reduce((acc, entry) => {
      if (!acc[entry.dayOfWeek]) {
        acc[entry.dayOfWeek] = [];
      }
      acc[entry.dayOfWeek].push(entry);
      return acc;
    }, {});

    // Sort each day's entries by start time
    Object.keys(groupedTimetable).forEach(day => {
      groupedTimetable[day].sort((a, b) => a.startTime.localeCompare(b.startTime));
    });

    res.json({
      timetable: groupedTimetable,
      totalEntries: timetable.length
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch teacher timetable.' });
  }
};

// Get today's timetable for a student
exports.getTodayTimetable = async (req, res) => {
  try {
    const studentId = req.user.id;
    const studentDepartment = req.user.department;
    const today = new Date().toLocaleLowerCase('en-US', { weekday: 'long' });

    // Find classes the student is enrolled in
    const enrolledClasses = await Class.find({
      students: studentId,
      status: 'Approved'
    }).select('name subject');

    // Get subjects from enrolled classes
    const enrolledSubjects = enrolledClasses.map(cls => cls.subject || cls.name);

    // Find today's timetable entries
    const todayTimetable = await Timetable.find({
      department: studentDepartment,
      subject: { $in: enrolledSubjects },
      dayOfWeek: today
    }).populate('teacher', 'name email');

    // Sort by start time
    todayTimetable.sort((a, b) => a.startTime.localeCompare(b.startTime));

    res.json(todayTimetable);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch today\'s timetable.' });
  }
};

// Preview timetable data from Excel file without saving
exports.previewTimetable = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded.' });
  }

  const department = req.user.department;
  if (!department) {
    return res.status(400).json({ message: 'User department not found.' });
  }

  try {
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(worksheet);

    const previewData = [];
    const errors = [];
    const warnings = [];

    for (let index = 0; index < data.length; index++) {
      const row = data[index];
      const { subject, teacherEmail, dayOfWeek, startTime, endTime, venue } = row;

      const rowData = {
        rowNumber: index + 2, // +2 because Excel rows start at 1 and we have headers
        subject,
        teacherEmail,
        dayOfWeek,
        startTime,
        endTime,
        venue,
        status: 'valid',
        errors: [],
        warnings: []
      };

      // Check for missing required fields
      if (!subject) {
        rowData.errors.push('Subject is required');
        rowData.status = 'error';
      }
      if (!teacherEmail) {
        rowData.errors.push('Teacher email is required');
        rowData.status = 'error';
      }
      if (!dayOfWeek) {
        rowData.errors.push('Day of week is required');
        rowData.status = 'error';
      }
      if (!startTime) {
        rowData.errors.push('Start time is required');
        rowData.status = 'error';
      }
      if (!endTime) {
        rowData.errors.push('End time is required');
        rowData.status = 'error';
      }
      if (!venue) {
        rowData.errors.push('Venue is required');
        rowData.status = 'error';
      }

      // If we have all required fields, do additional validation
      if (subject && teacherEmail && dayOfWeek && startTime && endTime && venue) {
        // Validate venue
        if (!VENUES.includes(venue)) {
          rowData.errors.push(`Invalid venue: ${venue}. Valid venues: ${VENUES.join(', ')}`);
          rowData.status = 'error';
        }

        // Check if teacher exists
        const teacher = await User.findOne({ email: teacherEmail });
        if (!teacher) {
          rowData.errors.push(`Teacher with email ${teacherEmail} not found`);
          rowData.status = 'error';
        } else if (teacher.role !== 'teacher') {
          rowData.errors.push(`User ${teacherEmail} is not a teacher`);
          rowData.status = 'error';
        } else {
          rowData.teacherName = teacher.name;
        }

        // Check for venue conflicts
        try {
          await checkVenueConflict(venue, dayOfWeek, startTime, endTime);
        } catch (conflictError) {
          rowData.errors.push(conflictError.message);
          rowData.status = 'error';
        }

        // Validate time format
        const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
        if (!timeRegex.test(startTime)) {
          rowData.errors.push('Invalid start time format. Use HH:MM (24-hour format)');
          rowData.status = 'error';
        }
        if (!timeRegex.test(endTime)) {
          rowData.errors.push('Invalid end time format. Use HH:MM (24-hour format)');
          rowData.status = 'error';
        }

        // Check if end time is after start time
        if (timeRegex.test(startTime) && timeRegex.test(endTime)) {
          const start = new Date(`1970-01-01T${startTime}:00`);
          const end = new Date(`1970-01-01T${endTime}:00`);
          if (end <= start) {
            rowData.errors.push('End time must be after start time');
            rowData.status = 'error';
          }
        }
      }

      previewData.push(rowData);

      // Collect all errors and warnings
      if (rowData.errors.length > 0) {
        errors.push(...rowData.errors.map(error => `Row ${rowData.rowNumber}: ${error}`));
      }
      if (rowData.warnings.length > 0) {
        warnings.push(...rowData.warnings.map(warning => `Row ${rowData.rowNumber}: ${warning}`));
      }
    }

    res.json({
      success: true,
      data: previewData,
      summary: {
        totalRows: data.length,
        validRows: previewData.filter(row => row.status === 'valid').length,
        errorRows: previewData.filter(row => row.status === 'error').length,
        warningRows: previewData.filter(row => row.warnings.length > 0).length
      },
      errors,
      warnings
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
