const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: [
    'service_request',
    'admin_alert',
    'class_enrollment',
    'fee_cleared',
    'enrollment_approved',
    'teacher_absence',
    'student_absence',
    'substitute_assigned',
    'timetable_update'
  ], required: true },
  title: String,
  message: String,
  data: Object,
  read: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Notification', notificationSchema);
