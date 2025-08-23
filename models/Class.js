const mongoose = require('mongoose');

const classSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String },
  timetable: [{
    day: String,
    startTime: String,
    endTime: String,
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    substituteTeacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  }],
  students: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  HOD: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = mongoose.model('Class', classSchema);
