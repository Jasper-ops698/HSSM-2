const Timetable = require('../models/Timetable');
const User = require('../models/User');
const xlsx = require('xlsx');
const VENUES = require('../config/venues');

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
    }

    res.status(201).json({ message: 'Timetable uploaded and processed successfully.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getTimetable = async (req, res) => {
  try {
    const timetable = await Timetable.find().populate('teacher', 'name');
    res.json(timetable);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch timetable.' });
  }
};
