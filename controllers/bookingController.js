const Booking = require('../models/Booking');
const Venue = require('../models/Venue');
const Announcement = require('../models/Announcement');
const User = require('../models/User');

// Get all venues
exports.getVenues = async (req, res) => {
  try {
    const venues = await Venue.find();
    res.json(venues);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Check venue availability
exports.checkAvailability = async (req, res) => {
  try {
    const { venueId, startTime, endTime } = req.body;

    const existingBooking = await Booking.findOne({
      venue: venueId,
      $or: [
        { startTime: { $lt: endTime }, endTime: { $gt: startTime } },
      ],
    });

    if (existingBooking) {
      return res.status(409).json({ available: false, message: 'Venue is already booked for the selected time.' });
    }

    res.json({ available: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create a new booking and announcement
exports.createBooking = async (req, res) => {
  try {
    const { venueId, startTime, endTime, announcementTitle, announcementContent } = req.body;
    const userId = req.user._id;
    const department = req.user.department;

    // Check for conflicts
    const conflictingBooking = await Booking.findOne({
      venue: venueId,
      $or: [
        { startTime: { $lt: endTime }, endTime: { $gt: startTime } },
      ],
    });

    if (conflictingBooking) {
      return res.status(409).json({ message: 'This venue is unavailable during the selected time.' });
    }

    // Create Announcement
    const announcement = new Announcement({
      title: announcementTitle,
      message: announcementContent,
      department,
      createdBy: userId,
    });
    await announcement.save();

    // Create Booking
    const booking = new Booking({
      venue: venueId,
      startTime,
      endTime,
      bookedBy: userId,
      announcement: announcement._id,
      department,
    });
    await booking.save();

    const populatedBooking = await Booking.findById(booking._id).populate('venue', 'name location');

    res.status(201).json({ message: 'Booking and announcement created successfully.', booking: populatedBooking });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get bookings for the logged-in user
exports.getUserBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({ bookedBy: req.user._id })
      .populate('venue')
      .populate('announcement');
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
