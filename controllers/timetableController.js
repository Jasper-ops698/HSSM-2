const Timetable = require('../models/Timetable');
const User = require('../models/User');
const Class = require('../models/Class');
const xlsx = require('xlsx');
const VENUES = require('../config/venues');
const NotificationService = require('../services/notificationService');
const Venue = require('../models/Venue');

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

    res.status(200).json({ preview, errors, warnings });
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
  if (!term || !startDate || !endDate) {
    return res.status(400).json({ message: 'Term, start date, and end date are required.' });
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
            const { subject, teacherEmail, dayOfWeek, startTime, endTime } = row;
            if (!subject || !teacherEmail || !dayOfWeek || !startTime || !endTime) {
              continue; // Skip incomplete rows
            }

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
              dayOfWeek,
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
    const timetable = await Timetable.find().populate('teacher', 'name');
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
    const { week } = req.query; // Expect week number from query

    if (!week) {
      return res.status(400).json({ message: 'Week number is required.' });
    }

    // Find classes the student is enrolled in
    const enrolledClasses = await Class.find({
      enrolledStudents: studentId,
    }).select('name');

    // Get subjects from enrolled classes
    const enrolledSubjects = enrolledClasses.map(cls => cls.name);

    // Find timetable entries for these subjects, department, and week
    const timetable = await Timetable.find({
      department: studentDepartment,
      subject: { $in: enrolledSubjects },
      week: parseInt(week, 10)
    }).populate('teacher', 'name email');

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
      enrolledClasses: enrolledClasses.length,
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
    const teacherId = req.user.id;
    const teacherDepartment = req.user.department;
    const { week } = req.query;

    if (!week) {
      return res.status(400).json({ message: 'Week number is required.' });
    }

    // Find timetable entries for this teacher, department, and week
    const timetable = await Timetable.find({
      teacher: teacherId,
      department: teacherDepartment,
      week: parseInt(week, 10)
    }).populate('teacher', 'name email');

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
      week: parseInt(week, 10)
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
    const dayOfWeek = today.toLocaleDateString('en-US', { weekday: 'long' });

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

    // Find classes the student is enrolled in
    const enrolledClasses = await Class.find({
      enrolledStudents: studentId,
    }).select('name');

    const enrolledSubjects = enrolledClasses.map(cls => cls.name);

    // Find today's timetable entries for the current week
    const todayTimetable = await Timetable.find({
      department: studentDepartment,
      subject: { $in: enrolledSubjects },
      dayOfWeek: dayOfWeek,
      week: currentWeek
    }).populate('teacher', 'name email');

    // Sort by start time
    todayTimetable.sort((a, b) => a.startTime.localeCompare(b.startTime));

    res.json(todayTimetable);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch today\'s timetable.' });
  }
};
