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
  term: { type: String, required: false },
  week: { type: Number, required: false },
  startDate: { type: Date, required: false },
  endDate: { type: Date, required: false },
  reminderSent: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('Timetable', timetableSchema);
