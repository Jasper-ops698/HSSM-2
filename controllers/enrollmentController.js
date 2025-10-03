const { NotificationHubsClient } = require("@azure/notification-hubs");
const { notificationHub } = require("../config/config");
const Enrollment = require('../models/Enrollment');
const Class = require('../models/Class');
const User = require('../models/User');
const Notification = require('../models/Notification');
const sendAzureNotification = require('../utils/sendAzureNotification');
const NotificationService = require('../services/notificationService');
// Socket helper to emit real-time events
const { getIO } = require('../src/socket');

/**
 * Student requests to enroll in a class
 */
exports.requestEnrollment = async (req, res) => {
  const { classId } = req.body;
  const studentId = req.user._id;

  try {
    // --- Weekday Check ---
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = Sunday, 6 = Saturday
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return res.status(400).json({ message: 'Enrollment requests can only be made on weekdays.' });
    }

    const targetClass = await Class.findById(classId);
    if (!targetClass) {
      return res.status(404).json({ message: 'Class not found.' });
    }

    const student = await User.findById(studentId);
    if (!student) {
      return res.status(404).json({ message: 'Student not found.' });
    }

    // Check if student is in the same department as the class
    if (student.department !== targetClass.department) {
      return res.status(403).json({ message: 'You can only enroll in classes from your assigned department. Please contact your HOD to be enrolled in the correct department.' });
    }
    if (!student || (targetClass.creditsRequired && student.credits < targetClass.creditsRequired)) {
      // Notify teacher and HOD about insufficient credits
      const teacher = await User.findById(targetClass.teacher);
      const hod = await User.findById(targetClass.HOD);

      const recipients = [];
      if (teacher?.deviceToken) recipients.push(teacher);
      if (hod?.deviceToken) recipients.push(hod);

      for (const recipient of recipients) {
        const notificationMessage = {
          notification: {
            title: 'Enrollment Request Denied',
            body: `${student.name} tried to enroll in ${targetClass.name} but has insufficient credits (${student.credits} available, ${targetClass.creditsRequired || 0} required).`,
          },
          token: recipient.deviceToken,
        };
        await sendAzureNotification(notificationMessage);
        await Notification.create({
          recipient: recipient._id,
          type: 'enrollment_rejected',
          title: 'Enrollment Request Denied',
          message: `${student.name} tried to enroll in ${targetClass.name} but has insufficient credits.`,
          data: { studentId, classId: classId, requiredCredits: targetClass.creditsRequired || 0, availableCredits: student.credits },
        });
      }

      return res.status(400).json({ message: `Insufficient credits to enroll. You have ${student.credits} credits, but ${targetClass.creditsRequired || 0} are required.` });
    }

    // Check if already enrolled or pending
    const existingEnrollment = await Enrollment.findOne({ student: studentId, class: classId });
    if (existingEnrollment) {
      return res.status(400).json({ message: 'You have already requested to enroll in this class.' });
    }

    // Create new enrollment request
    const newEnrollment = new Enrollment({
      student: studentId,
      class: classId,
      status: 'Pending',
    });
    await newEnrollment.save();

    // Load teacher and HOD so we can include extra context in emits
    const teacher = await User.findById(targetClass.teacher);
    const hod = await User.findById(targetClass.HOD);

    // --- Send Notifications ---
    const notificationMessage = `New enrollment request for ${targetClass.name} from ${student.name}.`;

    // 1. Create notifications in the database
    if (teacher) {
      await NotificationService.createNotification(teacher._id, 'New Enrollment Request', notificationMessage, { classId, studentId });
    }
    if (hod) {
      await NotificationService.createNotification(hod._id, 'New Enrollment Request', notificationMessage, { classId, studentId });
    }

    // 2. Send push notifications via Azure
    if (notificationHub.connectionString && notificationHub.hubName) {
      const client = new NotificationHubsClient(notificationHub.connectionString, notificationHub.hubName);
      const notificationPayload = {
        body: `{"aps":{"alert":"${notificationMessage}"}}`,
        headers: {
          "apns-priority": "10",
          "apns-push-type": "alert",
        },
      };
      const tags = [];
      if (teacher) tags.push(`user_${teacher._id}`);
      if (hod) tags.push(`user_${hod._id}`);
      if (tags.length > 0) {
        await client.sendNotification(notificationPayload, { tags });
      }
    }

    // --- Emit Socket Events ---
    const io = getIO();
    const payload = {
      studentId: String(studentId),
      classId: String(classId),
      enrollmentId: newEnrollment._id,
      status: 'Pending',
      studentName: student.name,
      className: targetClass.name,
    };
    io.to(String(studentId)).emit('enrollment_status_updated', payload);
    if (teacher) {
      io.to(String(teacher._id)).emit('new_enrollment_request', payload);
    }
    if (hod) {
      io.to(String(hod._id)).emit('new_enrollment_request', payload);
    }

    res.status(201).json({ message: 'Enrollment request sent successfully.', enrollment: newEnrollment });
  } catch (error) {
    console.error('Error requesting enrollment:', error);
    res.status(500).json({ message: 'Failed to send enrollment request.' });
  }
};

/**
 * Teacher or HOD approves/rejects an enrollment request
 */
exports.respondToEnrollment = async (req, res) => {
  const { enrollmentId, status, notes } = req.body; // status: 'Approved' or 'Rejected'
  const responderId = req.user._id;

  try {
    const enrollment = await Enrollment.findById(enrollmentId).populate('class student');
    if (!enrollment) {
      return res.status(404).json({ message: 'Enrollment request not found.' });
    }

    const targetClass = enrollment.class;
    // Authorization: only the class teacher or HOD can respond
    if (targetClass.teacher.toString() !== responderId.toString() && targetClass.HOD.toString() !== responderId.toString()) {
      return res.status(403).json({ message: 'You are not authorized to respond to this request.' });
    }

    if (status === 'Approved') {
      // Deduct credits and add student to class
      const student = enrollment.student;
      const creditsToDeduct = targetClass.creditsRequired || 0;
      student.credits -= creditsToDeduct;
      await student.save();

      // Send credit deduction notification
      await NotificationService.sendCreditNotification(student._id, creditsToDeduct, 'deduct');

      // Notify credit-controllers
      await NotificationService.notifyCreditControllers(student.name, targetClass.name, creditsToDeduct);

        // Emit credit_updated socket event so client's dashboards update immediately
        try {
          const io = getIO();
          io.to(`user:${String(student._id)}`).emit('credit_updated', { userId: String(student._id), credits: student.credits, amount: creditsToDeduct, action: 'deduct' });
        } catch (emitErr) {
          console.warn('Failed to emit credit_updated socket event from enrollment approval:', emitErr.message || emitErr);
        }

      targetClass.enrolledStudents.push(student._id);
      await targetClass.save();

      enrollment.status = 'Approved';
    } else if (status === 'Rejected') {
      enrollment.status = 'Rejected';
      enrollment.notes = notes;
    } else {
      return res.status(400).json({ message: 'Invalid status provided.' });
    }

    await enrollment.save();

    // Emit an update event so clients can reconcile the new enrollment status
    try {
      const io = getIO();
      const payload = {
        studentId: String(enrollment.student._id || enrollment.student),
        classId: String(targetClass._id),
        status: enrollment.status,
        enrollmentId: enrollment._id,
        studentName: enrollment.student?.name || undefined,
        className: targetClass?.name || undefined,
      };
      // Emit to the affected student
      io.to(`user:${String(enrollment.student._id || enrollment.student)}`).emit('enrollment_updated', payload);
      // Emit to the class teacher and HOD so they can refresh their views
      if (targetClass.teacher) io.to(`user:${String(targetClass.teacher)}`).emit('enrollment_updated', payload);
      if (targetClass.HOD) io.to(`user:${String(targetClass.HOD)}`).emit('enrollment_updated', payload);
    } catch (emitErr) {
      console.warn('Failed to emit enrollment_updated socket event:', emitErr.message || emitErr);
    }
    // --- Notify Student ---
    if (enrollment.student.deviceToken) {
      const notificationMessage = {
        notification: {
          title: `Enrollment ${status}`,
          body: `Your request to enroll in ${targetClass.name} has been ${status.toLowerCase()}.`,
        },
        token: enrollment.student.deviceToken,
      };
      await sendAzureNotification(notificationMessage);
      await Notification.create({
        recipient: enrollment.student._id,
        type: status === 'Approved' ? 'enrollment_approved' : 'enrollment_rejected',
        title: `Enrollment ${status}`,
        message: `Your request for ${targetClass.name} has been ${status.toLowerCase()}.`,
        data: { enrollmentId },
      });
    }

    res.status(200).json({ message: `Enrollment successfully ${status.toLowerCase()}.`, enrollment });
  } catch (error) {
    console.error('Error responding to enrollment:', error);
    res.status(500).json({ message: 'Server error while responding to enrollment.' });
  }
};

/**
 * Get all enrollments (for admin/HOD view)
 */
exports.getAllEnrollments = async (req, res) => {
  try {
    // Further filtering can be added based on HOD's department
    const enrollments = await Enrollment.find().populate('student', 'name').populate('class', 'name autoGenerated creditsRequired');
    res.status(200).json(enrollments);
  } catch (error) {
    console.error('Error fetching all enrollments:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

/**
 * Get enrollments for a specific class (for teachers)
 */
exports.getEnrollmentsByClass = async (req, res) => {
  const { classId } = req.params;
  const userId = req.user._id;

  try {
    // First verify that the user is the teacher of this class
    const targetClass = await Class.findById(classId);
    if (!targetClass) {
      return res.status(404).json({ message: 'Class not found.' });
    }

    // Check if user is the teacher or HOD of this class
    if (targetClass.teacher.toString() !== userId.toString() && targetClass.HOD.toString() !== userId.toString()) {
      return res.status(403).json({ message: 'You are not authorized to view enrollments for this class.' });
    }

    const enrollments = await Enrollment.find({ class: classId })
      .populate('student', 'name email')
      .populate('class', 'name autoGenerated creditsRequired')
      .sort({ createdAt: -1 });

    res.status(200).json(enrollments);
  } catch (error) {
    console.error('Error fetching enrollments by class:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

module.exports = {
  requestEnrollment: exports.requestEnrollment,
  respondToEnrollment: exports.respondToEnrollment,
  getAllEnrollments: exports.getAllEnrollments,
  getEnrollmentsByClass: exports.getEnrollmentsByClass,
};
