const mongoose = require('mongoose');
const VENUES = require('../config/venues');

const timetableSchema = new mongoose.Schema({
  subject: { type: String, required: true },
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  department: { type: String, required: true },
  dayOfWeek: { type: String, required: true },
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  venue: { 
    type: String, 
    required: true,
    enum: {
      values: VENUES,
      message: '"{VALUE}" is not a valid venue.'
    }
  },
  reminderSent: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('Timetable', timetableSchema);
