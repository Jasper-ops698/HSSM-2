const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema({
  title: { 
    type: String, 
    required: true, 
    trim: true 
  },
  message: { 
    type: String,
    required: true,
    maxlength: 5000
  },
  department: {
    type: String,
    trim: true,
  },
  targetClass: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
    required: false,
  },
  targetAudience: {
    type: String,
    enum: ['all', 'class', 'specific'],
    default: 'all'
  },
  targetRoles: {
    type: [String],
    enum: ['all', 'student', 'teacher', 'HOD', 'admin', 'credit-controller', 'HSSM-provider'],
    default: ['student']
  },
  targetScope: {
    type: String,
    enum: ['department', 'global'],
    default: 'department'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  active: {
    type: Boolean,
    default: true
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  startDate: {
    type: Date,
    default: Date.now
  },
  endDate: {
    type: Date
  },
  readBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }]
}, { timestamps: true });

module.exports = mongoose.model('Announcement', announcementSchema);
