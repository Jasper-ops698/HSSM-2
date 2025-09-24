const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  department: { type: String },
  dateOfSession: { type: Date, required: true }, // date of the class session (normalized to date)
  status: { type: String, enum: ['present', 'absent', 'late', 'excused'], default: 'present' },
  markedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  notes: { type: String },
}, { timestamps: true });

attendanceSchema.index({ class: 1, student: 1, dateOfSession: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', attendanceSchema);
