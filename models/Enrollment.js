const mongoose = require('mongoose');

const enrollmentSchema = new mongoose.Schema({
  student: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    required: true,
  },
  class: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Class',
    required: true,
  },
  status: { 
    type: String, 
    enum: ['Pending', 'Approved', 'Rejected', 'Completed'], 
    default: 'Pending' 
  },
  // This can be used by the teacher or HOD to provide feedback on rejection
  notes: {
    type: String,
  },
}, { timestamps: true });

module.exports = mongoose.model('Enrollment', enrollmentSchema);
