const mongoose = require('mongoose');

const absenceSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  role: { type: String, enum: ['student', 'teacher'], required: true },
  class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class' },
  reason: { type: String, required: true },
  date: { type: Date, required: true },
  duration: { type: Number, required: true }, // in days or hours
  evidence: { type: String }, // file path or URL
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
}, { timestamps: true });

module.exports = mongoose.model('Absence', absenceSchema);
