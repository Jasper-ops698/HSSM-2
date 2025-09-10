const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: [
    'service_request',
    'admin_alert',
    'class_enrollment',
    'fee_cleared',
    'enrollment_approved',
    'enrollment_rejected',
    'student_absence',
    'teacher_absence',
    'substitute_assigned',
    'timetable_update',
    'staff_registration',
    'role_assigned',
    'credit_update',
    'credit_deduction',
    'performance_update'
  ], required: true },
  type: { type: String, enum: [
    'service_request',
    'admin_alert',
    'class_enrollment',
    'fee_cleared',
    'enrollment_approved',
    'teacher_absence',
    'student_absence',
    'substitute_assigned',
    'timetable_update',
    'staff_registration',
    'role_assigned'
  ], required: true },
  title: String,
  message: String,
  data: mongoose.Schema.Types.Mixed,
  read: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Notification', notificationSchema);
