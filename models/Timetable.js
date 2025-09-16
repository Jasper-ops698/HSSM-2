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
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Venue',
    required: false 
  },
  term: { type: String, required: true },
  week: { type: Number, required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  reminderSent: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('Timetable', timetableSchema);
