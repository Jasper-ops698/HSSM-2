const mongoose = require('mongoose');


const absenceSchema = new mongoose.Schema({
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  department: { type: String, required: true },
  dateOfAbsence: { type: Date, required: true },
  duration: { type: Number, required: true },
  reason: { type: String },
  status: {
    type: String,
    enum: ['Pending', 'pending', 'approved', 'rejected', 'Covered', 'Cancelled'],
    default: 'Pending',
  },
  replacementTeacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

// Custom validation: either teacher or student must be present
absenceSchema.pre('validate', function(next) {
  if (!this.teacher && !this.student) {
    this.invalidate('teacher', 'Either teacher or student is required.');
    this.invalidate('student', 'Either teacher or student is required.');
  }
  next();
});

module.exports = mongoose.model('Absence', absenceSchema);
