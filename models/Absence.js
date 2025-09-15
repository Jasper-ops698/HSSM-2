const mongoose = require('mongoose');

const absenceSchema = new mongoose.Schema({
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  department: { type: String, required: true },
  dateOfAbsence: { type: Date, required: true },
  reason: { type: String },
  status: {
    type: String,
    enum: ['Pending', 'Covered', 'Cancelled'],
    default: 'Pending',
  },
  replacementTeacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = mongoose.model('Absence', absenceSchema);
