const Timetable = require('../models/Timetable');
const User = require('../models/User');
const Class = require('../models/Class');
const xlsx = require('xlsx');
const VENUES = require('../config/venues');
const NotificationService = require('../services/notificationService');
const Venue = require('../models/Venue');
const Announcement = require('../models/Announcement');
const Notification = require('../models/Notification');
const { getIO } = require('../src/socket');

// Helper function to parse week ranges from sheet names (e.g., "Weeks 1-5" or "Week 6")
function parseWeekRange(sheetName) {
  const singleWeekMatch = sheetName.match(/Week (\d+)/i);
  if (singleWeekMatch) {
    const week = parseInt(singleWeekMatch[1], 10);
    return { start: week, end: week };
  }

  const rangeMatch = sheetName.match(/Weeks (\d+)-(\d+)/i);
  if (rangeMatch) {
    const start = parseInt(rangeMatch[1], 10);
    const end = parseInt(rangeMatch[2], 10);
    return { start, end };
  }

  return null; // Return null if the format is invalid
}

// Helper function to check for venue conflicts
async function checkVenueConflict(venueId, day, startTime, endTime, term, week, excludeId = null) {
  const query = {
    venue: venueId,
    dayOfWeek: day,
    term: term,
    week: week,
    $or: [
      { startTime: { $lt: endTime }, endTime: { $gt: startTime } }
    ]
  };

  if (excludeId) {
    query._id = { $ne: excludeId };
  }

  const conflict = await Timetable.findOne(query);
  if (conflict) {
    const conflictingVenue = await Venue.findById(venueId);
    throw new Error(`Booking conflict: Venue "${conflictingVenue.name}" is already booked from ${conflict.startTime} to ${conflict.endTime} on ${day}.`);
  }
}

exports.previewTimetable = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded.' });
  }

  try {
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const preview = {};
    const errors = [];
    const warnings = [];

    for (const sheetName of workbook.SheetNames) {
      const weekRange = parseWeekRange(sheetName);
      if (!weekRange) {
        warnings.push(`Skipping sheet with invalid name format: "${sheetName}"`);
        continue;
      }

      const worksheet = workbook.Sheets[sheetName];
      const schedule = xlsx.utils.sheet_to_json(worksheet);
      
      preview[sheetName] = {
        weekRange,
        schedule,
        rowCount: schedule.length,
      };
    }

    if (Object.keys(preview).length === 0) {
      errors.push('No valid sheets found in the uploaded file.');
    }

    // Calculate summary statistics
    let totalRows = 0;
    let validRows = 0;
    let errorRows = 0;
    let warningRows = 0;

    Object.values(preview).forEach(sheet => {
      totalRows += sheet.rowCount;
      // For now, assume all rows are valid if no specific validation is done
      validRows += sheet.rowCount;
    });

    // Add error and warning counts based on arrays
    errorRows = errors.length;
    warningRows = warnings.length;

    const summary = {
      totalRows,
      validRows,
      errorRows,
      warningRows
    };

    res.status(200).json({ preview, errors, warnings, summary });
  } catch (error) {
    console.error('Error previewing timetable:', error);
    res.status(500).json({ message: 'Failed to preview timetable.', error: error.message });
  }
};

exports.uploadTimetable = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded.' });
  }

  const { term, startDate, endDate } = req.body;
// Remove strict requirement for term, startDate, and endDate
// If provided, use them; if not, proceed with defaults or handle accordingly
// Example: Only warn if missing, but do not return error
if (!term || !startDate || !endDate) {
  console.warn('Warning: Term, start date, or end date not provided.');
}

  const department = req.user.department;
  if (!department) {
    return res.status(400).json({ message: 'User department not found.' });
  }

  try {
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const termStartDate = new Date(startDate);
    const termEndDate = new Date(endDate);

    // Clear existing timetable for the entire term to ensure a fresh start
    await Timetable.deleteMany({ department, term });

    let allSchedulesForClassGen = [];
    const errors = [];

    // Process each sheet in the Excel file
    for (const sheetName of workbook.SheetNames) {
      const weekRange = parseWeekRange(sheetName);
      if (!weekRange) {
        console.warn(`Skipping sheet with invalid name format: "${sheetName}"`);
        continue;
      }

      const worksheet = workbook.Sheets[sheetName];
      const weeklySchedule = xlsx.utils.sheet_to_json(worksheet);
      
      // Add unique entries to the list for class generation
      weeklySchedule.forEach(row => {
        if (!allSchedulesForClassGen.some(existing => existing.subject === row.subject && existing.teacherEmail === row.teacherEmail)) {
          allSchedulesForClassGen.push(row);
        }
      });

      // Apply this schedule to the specified week range
      let currentWeekStart = new Date(termStartDate);
      let weekNumber = 1;
      while (currentWeekStart < termEndDate) {
        if (weekNumber >= weekRange.start && weekNumber <= weekRange.end) {
          const currentWeekEnd = new Date(currentWeekStart);
          currentWeekEnd.setDate(currentWeekEnd.getDate() + 6);

          for (const row of weeklySchedule) {
            const { subject, teacherEmail, dayOfWeek: rawDay, startTime, endTime } = row;
            if (!subject || !teacherEmail || !rawDay || !startTime || !endTime) {
              continue; // Skip incomplete rows
            }

            // Normalize dayOfWeek to stable lowercase key (e.g., 'monday')
            const WEEKDAY_KEYS = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
            const dayLower = String(rawDay).trim().toLowerCase();
            // Map common short forms like 'mon' or 'monday' to the key
            const foundIndex = WEEKDAY_KEYS.findIndex(k => k === dayLower || k.startsWith(dayLower) || dayLower.startsWith(k));
            const normalizedDay = foundIndex !== -1 ? WEEKDAY_KEYS[foundIndex] : dayLower;

            const teacher = await User.findOne({ email: teacherEmail });
            if (!teacher) {
              const errorMsg = `Teacher with email ${teacherEmail} not found (from sheet "${sheetName}").`;
              if (!errors.includes(errorMsg)) errors.push(errorMsg);
              continue; // Skip this entry
            }

            const newEntry = new Timetable({
              subject,
              teacher: teacher._id,
              department,
              dayOfWeek: normalizedDay,
              startTime,
              endTime,
              venue: null, // Venue is optional
              term,
              week: weekNumber,
              startDate: currentWeekStart,
              endDate: currentWeekEnd,
            });
            await newEntry.save();
          }
        }
        currentWeekStart.setDate(currentWeekStart.getDate() + 7);
        weekNumber++;
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({ message: 'Failed to upload timetable due to errors.', errors });
    }

    // Auto-generate classes from the consolidated list of all unique timetable entries
    const timetableDataForClassGen = allSchedulesForClassGen.map(row => ({ ...row, department }));
    try {
      const generatedClasses = await autoGenerateClassesFromTimetable(timetableDataForClassGen, department);
      console.log(`Successfully auto-generated/updated ${generatedClasses.length} classes`);
    } catch (autoGenError) {
      console.error('Error during auto-generation:', autoGenError);
    }

    await NotificationService.notifyTimetableUpdate(department, req.user.name || req.user.email);

    res.status(201).json({ message: `Timetable for term "${term}" uploaded and processed successfully.` });
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
        const teacher = await User.findOne({ email: entry.teacherEmail });
        if (!teacher) {
            console.warn(`Skipping class generation for subject "${entry.subject}" as teacher with email ${entry.teacherEmail} was not found.`);
            continue;
        }
        subjectsMap.set(entry.subject, {
          subject: entry.subject,
          teacher: teacher._id,
          department: department,
          timetable: []
        });
      }
      // This part might need adjustment if timetable structure in Class model is different
      // For now, assuming it's a general representation
      subjectsMap.get(entry.subject).timetable.push({
        day: entry.dayOfWeek,
        startTime: entry.startTime,
        endTime: entry.endTime,
        venue: entry.venue
      });
    }

    const generatedClasses = [];

    // Create or update classes for each subject
    for (const [subjectName, subjectData] of subjectsMap) {
      try {
        // Calculate credits based on number of unique days from the first week's schedule as a representative
        const creditsRequired = calculateCreditsFromTimetable(subjectData.timetable);

        // Check if class already exists
        const existingClass = await Class.findOne({
          name: subjectName,
          department: department,
          teacher: subjectData.teacher
        });

        if (existingClass) {
          // Update existing class with new representative timetable and credits
          existingClass.timetable = subjectData.timetable;
          existingClass.creditsRequired = creditsRequired;
          await existingClass.save();
          console.log(`Updated existing class: ${subjectName}`);
           generatedClasses.push(existingClass);
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
            timetable: subjectData.timetable, // Representative timetable
            HOD: hod ? hod._id : null,
            enrolledStudents: [],
            autoGenerated: true,
          });

          await newClass.save();
          generatedClasses.push(newClass);
          console.log(`Created new class: ${subjectName} (${creditsRequired} credits)`);
        }
      } catch (error) {
        console.error(`Error creating/updating class for ${subjectName}:`, error);
      }
    }

    console.log(`Auto-generated/updated ${generatedClasses.length} classes from timetable`);
    return generatedClasses;
  } catch (error) {
    console.error('Error in auto-generating classes:', error);
    throw error;
  }
}

exports.getTimetable = async (req, res) => {
  try {
  const timetable = await Timetable.find().populate('teacher', 'name').populate('replacement.teacher', 'name');
    res.json(timetable);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch timetable.' });
  }
};

// Get timetable for a specific student for a given week
exports.getStudentTimetable = async (req, res) => {
  try {
      const studentId = req.user.id;
      const studentDepartment = req.user.department;
      let { week } = req.query; // Expect week number from query

      // If week is not provided, attempt to derive the current week based on any
      // timetable entry that covers today's date. This makes the endpoint more
      // resilient when frontend and backend may use different term start dates.
      if (!week) {
        const today = new Date();
        try {
          const anyEntry = await Timetable.findOne({
            department: studentDepartment,
            startDate: { $lte: today },
            endDate: { $gte: today }
          });
          if (anyEntry && anyEntry.week) {
            week = anyEntry.week;
          } else {
            // Fall back to week 1 when no matching entry found
            week = 1;
          }
        } catch (e) {
          // In case of lookup issues, safely default to week 1
          week = 1;
        }
      }

    // Pull department classes for discovery/enrollment cards
    const departmentClasses = await Class.find({ department: studentDepartment });

    // Identify classes the student is currently enrolled in
    const enrolledClasses = await Class.find({
      enrolledStudents: studentId,
      department: studentDepartment
    }).select('_id name');

    const enrolledClassIds = enrolledClasses.map(cls => String(cls._id));
    const enrolledClassNames = enrolledClasses
      .map(cls => (cls.name || '').trim())
      .filter(Boolean);

    const weekNumber = parseInt(week, 10);

    let timetable = [];
    if (enrolledClassNames.length > 0) {
      timetable = await Timetable.find({
        department: studentDepartment,
        week: weekNumber,
        subject: { $in: enrolledClassNames }
      })
        .populate('teacher', 'name email')
        .populate('replacement.teacher', 'name email')
        .populate('venue', 'name location');
    }

    // If a specific week was requested but returned nothing, attempt to derive
    // the current active week for the student's enrolled subjects
    if (
      timetable.length === 0 &&
      enrolledClassNames.length > 0 &&
      typeof req.query.week === 'string'
    ) {
      const today = new Date();
      const fallbackEntry = await Timetable.findOne({
        department: studentDepartment,
        subject: { $in: enrolledClassNames },
        startDate: { $lte: today },
        endDate: { $gte: today }
      })
        .populate('teacher', 'name email')
        .populate('replacement.teacher', 'name email')
        .populate('venue', 'name location');

      if (fallbackEntry && fallbackEntry.week && fallbackEntry.week !== weekNumber) {
        timetable = await Timetable.find({
          department: studentDepartment,
          week: fallbackEntry.week,
          subject: { $in: enrolledClassNames }
        })
          .populate('teacher', 'name email')
          .populate('replacement.teacher', 'name email')
          .populate('venue', 'name location');
        week = fallbackEntry.week;
      }
    }

    // Group by day for better display
    const groupedTimetable = timetable.reduce((acc, entry) => {
      const day = entry.dayOfWeek;
      if (!acc[day]) {
        acc[day] = [];
      }
      acc[day].push(entry);
      return acc;
    }, {});

    // Sort each day's entries by start time
    Object.keys(groupedTimetable).forEach(day => {
      groupedTimetable[day].sort((a, b) => a.startTime.localeCompare(b.startTime));
    });

    res.json({
      timetable: groupedTimetable,
      departmentClasses,
      enrolledClasses: enrolledClassIds,
      totalEntries: timetable.length,
      week: parseInt(week, 10)
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch student timetable.' });
  }
};

// Get timetable for a specific teacher for a given week
exports.getTeacherTimetable = async (req, res) => {
  try {
    // Prefer _id (mongoose document) but accept id string as well
  const teacherId = req.user && (req.user._id || req.user.id || req.user.userId);
  const teacherIdStr = teacherId ? String(teacherId) : '';
    let teacherDepartment = req.user && req.user.department;
    let { week } = req.query;

    // Ensure we have a department; if not, try to fetch from DB (safe fallback)
    if (!teacherDepartment && teacherId) {
      try {
        const teacherUser = await User.findById(teacherId).select('department');
        if (teacherUser && teacherUser.department) teacherDepartment = teacherUser.department;
      } catch (e) {
        // ignore lookup errors and proceed — department may remain undefined
      }
    }

    // If week is not provided, try to derive the current week from any timetable entry
    if (!week) {
      const today = new Date();
      const anyEntry = await Timetable.findOne({
        $or: [
          { teacher: teacherId },
          { 'replacement.teacher': teacherId }
        ],
        startDate: { $lte: today },
        endDate: { $gte: today }
      });
      if (anyEntry && anyEntry.week) {
        week = anyEntry.week;
      } else {
        // As a last resort, default to week 1
        week = 1;
      }
    }

    const weekNumber = parseInt(week, 10);

    const primaryCondition = teacherDepartment
      ? { teacher: teacherId, department: teacherDepartment }
      : { teacher: teacherId };

    const query = {
      week: weekNumber,
      $or: [
        primaryCondition,
        { 'replacement.teacher': teacherId }
      ]
    };

    const timetableDocs = await Timetable.find(query)
      .populate('teacher', 'name email')
      .populate('replacement.teacher', 'name email')
      .populate('venue', 'name location');

    // Remove potential duplicates
    const uniqueMap = new Map();
    timetableDocs.forEach(doc => {
      uniqueMap.set(String(doc._id), doc);
    });

    const timetable = Array.from(uniqueMap.values()).map(doc => {
      const obj = doc.toObject();
      const teacherObj = obj.teacher;
      const replacementTeacher = obj.replacement && obj.replacement.teacher;
      const teacherObjId = teacherObj && (teacherObj._id || teacherObj);
      const replacementTeacherId = replacementTeacher && (replacementTeacher._id || replacementTeacher);
      obj.isPrimaryAssignment = String(teacherObjId || '') === teacherIdStr;
      obj.isReplacementAssignment = String(replacementTeacherId || '') === teacherIdStr && !obj.isPrimaryAssignment;
      return obj;
    });

    // Group by day for better display
    const groupedTimetable = timetable.reduce((acc, entry) => {
      const day = entry.dayOfWeek;
      if (!acc[day]) {
        acc[day] = [];
      }
      acc[day].push(entry);
      return acc;
    }, {});

    // Sort each day's entries by start time
    Object.keys(groupedTimetable).forEach(day => {
      groupedTimetable[day].sort((a, b) => a.startTime.localeCompare(b.startTime));
    });

    res.json({
      timetable: groupedTimetable,
      totalEntries: timetable.length,
      week: weekNumber
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch teacher timetable.' });
  }
};

// Get today's timetable for a student, considering the current week
exports.getTodayTimetable = async (req, res) => {
  try {
    const studentId = req.user.id;
    const studentDepartment = req.user.department;
  const today = new Date();
  const WEEKDAY_KEYS = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  const dayOfWeek = WEEKDAY_KEYS[today.getDay()];

    // Find the current week number based on today's date
    // This logic assumes term start/end dates are stored somewhere accessible
    // For this implementation, we find any timetable entry to determine the week
    const anyTimetableEntry = await Timetable.findOne({
        department: studentDepartment,
        startDate: { $lte: today },
        endDate: { $gte: today }
    });

    if (!anyTimetableEntry) {
      return res.json([]); // No classes scheduled for today or term not found
    }
    const currentWeek = anyTimetableEntry.week;

    // Find classes the student is enrolled in. We select both _id and name here because
    // the subsequent query filters timetable entries by subject name. Note: the
    // GET /api/timetable/student endpoint now returns `enrolledClasses` as an array of
    // class ID strings for consistency.
    const enrolledClasses = await Class.find({
      enrolledStudents: studentId,
    }).select('_id name');

    const enrolledSubjects = enrolledClasses.map(cls => cls.name);

    // Find today's timetable entries for the current week
    const todayTimetable = await Timetable.find({
      department: studentDepartment,
      subject: { $in: enrolledSubjects },
      dayOfWeek: dayOfWeek,
      week: currentWeek
    })
      .populate('teacher', 'name email')
      .populate('replacement.teacher', 'name email')
      .populate('venue', 'name location');

    // Sort by start time
    todayTimetable.sort((a, b) => a.startTime.localeCompare(b.startTime));

    res.json(todayTimetable);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch today\'s timetable.' });
  }
};

// Assign a replacement teacher for a specific timetable entry (HOD/Admin only)
exports.assignReplacement = async (req, res) => {
  try {
    const timetableId = req.params.id;
    const { replacementTeacherId, replacementName, reason } = req.body;

    if (!timetableId) {
      return res.status(400).json({ message: 'Timetable entry id is required' });
    }

    const entry = await Timetable.findById(timetableId).populate('teacher', 'name');
    if (!entry) {
      return res.status(404).json({ message: 'Timetable entry not found' });
    }

    // Build replacement object
    const replacement = {};
    if (replacementTeacherId) replacement.teacher = replacementTeacherId;
    if (replacementName) replacement.teacherName = replacementName;
    replacement.reason = reason || '';
    replacement.assignedBy = req.user._id;
    replacement.assignedAt = new Date();

    entry.replacement = replacement;
    await entry.save();

    // Create an announcement so students and the assigned teacher are notified
    try {
      const classForSubject = await Class.findOne({ name: entry.subject, department: entry.department });
      const announcementTitle = `Teacher change for ${entry.subject}`;
      const announcementMessage = `A replacement teacher has been assigned for ${entry.subject} on ${entry.dayOfWeek} ${entry.startTime} - ${entry.endTime}. Replacement: ${replacement.teacherName || 'Assigned teacher'}. Reason: ${replacement.reason || 'Not specified'}`;

      const announcement = new Announcement({
        title: announcementTitle,
        message: announcementMessage,
        department: entry.department,
        targetRoles: ['student', 'teacher'],
        createdBy: req.user._id,
        active: true,
        startDate: new Date()
      });
      if (classForSubject) {
        announcement.targetClass = classForSubject._id; // note: Announcement schema may not have targetClass; but controller earlier accepts arbitrary fields
      }
      await announcement.save();
      // Create a notification for the replacement teacher if provided
      if (replacement.teacher) {
        try {
          const replacementTeacher = await User.findById(replacement.teacher).select('name');
          if (replacementTeacher) {
            await Notification.create({
              recipient: replacementTeacher._id,
              type: 'substitute_assigned',
              title: 'You have been assigned as a substitute',
              message: `You have been assigned to cover ${entry.subject} on ${entry.dayOfWeek} ${entry.startTime} - ${entry.endTime}.`,
              data: { timetableId: entry._id }
            });

            // Emit socket event to the replacement teacher
            try {
              const io = getIO();
              io.to(`user:${replacementTeacher._id}`).emit('replacement_assigned', { timetableId: entry._id, subject: entry.subject, dayOfWeek: entry.dayOfWeek, startTime: entry.startTime, endTime: entry.endTime });
            } catch (e) {
              console.warn('Socket emit failed for replacement_assigned (timetable):', e.message || e);
            }
          }
        } catch (e) {
          console.warn('Failed to create notification for replacement teacher:', e.message || e);
        }
      }

      // Emit timetable_updated to class room if available
      try {
        const io = getIO();
        if (entry.class) io.to(`class:${String(entry.class)}`).emit('timetable_updated', { entryId: entry._id, replacement: entry.replacement });
      } catch (e) {
        console.warn('Socket emit failed for timetable_updated (timetable):', e.message || e);
      }
    } catch (announceErr) {
      console.warn('Failed to create announcement for replacement assignment:', announceErr);
    }

    res.status(200).json({ message: 'Replacement assigned', entry });
  } catch (error) {
    console.error('Error assigning replacement:', error);
    res.status(500).json({ message: 'Failed to assign replacement' });
  }
};

// Get timetable entries for a specific class (by Class _id)
exports.getEntriesForClass = async (req, res) => {
  try {
    const classId = req.params.classId;
    const { week } = req.query;

    const cls = await Class.findById(classId);
    if (!cls) return res.status(404).json({ message: 'Class not found' });

    const query = { subject: cls.name, department: cls.department };
    if (week) query.week = parseInt(week, 10);

    const entries = await Timetable.find(query).populate('teacher', 'name email').populate('replacement.teacher', 'name');

    res.status(200).json({ success: true, entries });
  } catch (error) {
    console.error('Error fetching timetable entries for class:', error);
    res.status(500).json({ message: 'Failed to fetch entries' });
  }
};
