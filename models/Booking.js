const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  venue: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Venue',
    required: true,
  },
  startTime: {
    type: Date,
    required: true,
  },
  endTime: {
    type: Date,
    required: true,
  },
  bookedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  announcement: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Announcement',
  },
  department: {
    type: String,
    required: true,
  },
}, { timestamps: true });

bookingSchema.index({ venue: 1, startTime: 1, endTime: 1 });

const Booking = mongoose.model('Booking', bookingSchema);

module.exports = Booking;
