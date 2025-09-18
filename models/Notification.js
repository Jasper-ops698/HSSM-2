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
    'performance_update',
    'incident',
    'overdue_task',
    'asset_maintenance',
    'meter_reading',
    'new_announcement'
  ], required: true },
  title: String,
  message: String,
  data: mongoose.Schema.Types.Mixed,
  read: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Notification', notificationSchema);
