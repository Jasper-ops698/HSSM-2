const Venue = require('../models/Venue');
const Timetable = require('../models/Timetable');
const Class = require('../models/Class');
const asyncHandler = require('express-async-handler');
const NotificationService = require('../services/notificationService');
const { getIO } = require('../src/socket');

// @desc    Get all venues
// @route   GET /api/venues
// @access  Private/Admin
const getVenues = asyncHandler(async (req, res) => {
  const venues = await Venue.find({});
  res.json(venues);
});

// @desc    Create a venue
// @route   POST /api/venues
// @access  Private/Admin
const createVenue = asyncHandler(async (req, res) => {
  const { name, capacity, location } = req.body;

  if (!name) {
    res.status(400);
    throw new Error('Venue name is required');
  }

  const venueExists = await Venue.findOne({ name });

  if (venueExists) {
    res.status(400);
    throw new Error('Venue already exists');
  }

  const venue = new Venue({
    name,
    capacity,
    location,
  });

  const createdVenue = await venue.save();
  res.status(201).json(createdVenue);
});

// @desc    Update a venue
// @route   PUT /api/venues/:id
// @access  Private/Admin
const updateVenue = asyncHandler(async (req, res) => {
  const { name, capacity, isAvailable } = req.body;

  const venue = await Venue.findById(req.params.id);

  if (venue) {
    venue.name = name || venue.name;
    venue.capacity = capacity || venue.capacity;
    venue.isAvailable = isAvailable !== undefined ? isAvailable : venue.isAvailable;

    const updatedVenue = await venue.save();
    res.json(updatedVenue);
  } else {
    res.status(404);
    throw new Error('Venue not found');
  }
});

// @desc    Delete a venue
// @route   DELETE /api/venues/:id
// @access  Private/Admin
const deleteVenue = asyncHandler(async (req, res) => {
  const venue = await Venue.findById(req.params.id);

  if (venue) {
    await venue.deleteOne();
    res.json({ message: 'Venue removed' });
  } else {
    res.status(404);
    throw new Error('Venue not found');
  }
});

// @desc    Get available venues for a given time slot
// @route   GET /api/venues/available
// @access  Private
const getAvailableVenues = asyncHandler(async (req, res) => {
  const { dayOfWeek, startTime, endTime, term, week, classId } = req.query;

  // Find the class to get the number of enrolled students
  const classData = await Class.findById(classId);
  const enrolledStudentsCount = classData ? classData.enrolledStudents.length : 0;

  // Find all timetable entries that conflict with the given time slot
  const conflictingEntries = await Timetable.find({
    dayOfWeek,
    term,
    week,
    $or: [
      { startTime: { $lt: endTime }, endTime: { $gt: startTime } }
    ],
    venue: { $ne: null }
  }).select('venue');

  const bookedVenueIds = conflictingEntries.map(entry => entry.venue);

  // Find all venues that are not in the booked list and have enough capacity
  const availableVenues = await Venue.find({
    _id: { $nin: bookedVenueIds },
    isAvailable: true,
    capacity: { $gte: enrolledStudentsCount }
  });

  res.json(availableVenues);
});

// @desc    Assign a venue to a timetable entry
// @route   POST /api/venues/assign
// @access  Private/Teacher
const assignVenue = asyncHandler(async (req, res) => {
  const { timetableId, venueId } = req.body;

  const timetableEntry = await Timetable.findById(timetableId);
  if (!timetableEntry) {
    res.status(404);
    throw new Error('Timetable entry not found');
  }

  try {
    // Check for conflicts before assigning
    await checkVenueConflict(
      venueId,
      timetableEntry.dayOfWeek,
      timetableEntry.startTime,
      timetableEntry.endTime,
      timetableEntry.term,
      timetableEntry.week
    );

    timetableEntry.venue = venueId;
    await timetableEntry.save();

    // Notify students about the venue change
    try {
      const populatedEntry = await Timetable.findById(timetableId).populate('venue teacher');
      
      // Emit a real-time event
      getIO().emit('venue_updated', populatedEntry);

      await NotificationService.notifyVenueUpdate(populatedEntry);
    } catch (error) {
      console.error('Failed to send venue update notification:', error);
    }

    res.json({ message: 'Venue assigned successfully' });
  } catch (error) {
    // If there is a conflict, suggest other available venues
    const classData = await Class.findOne({ name: timetableEntry.subject, department: timetableEntry.department });
    const enrolledStudentsCount = classData ? classData.enrolledStudents.length : 0;

    const conflictingEntries = await Timetable.find({
      dayOfWeek: timetableEntry.dayOfWeek,
      term: timetableEntry.term,
      week: timetableEntry.week,
      $or: [
        { startTime: { $lt: timetableEntry.endTime }, endTime: { $gt: timetableEntry.startTime } }
      ],
      venue: { $ne: null }
    }).select('venue');

    const bookedVenueIds = conflictingEntries.map(entry => entry.venue);

    const alternativeVenues = await Venue.find({
      _id: { $nin: bookedVenueIds },
      isAvailable: true,
      capacity: { $gte: enrolledStudentsCount }
    });

    res.status(409).json({
      message: error.message,
      suggestions: alternativeVenues
    });
  }
});

module.exports = {
  getVenues,
  createVenue,
  updateVenue,
  deleteVenue,
  getAvailableVenues,
  assignVenue,
};
