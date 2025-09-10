const Enrollment = require('../models/Enrollment');
const Class = require('../models/Class');
const User = require('../models/User');
const Notification = require('../models/Notification');
const sendFCMNotification = require('../utils/sendFCMNotification');
const NotificationService = require('../services/notificationService');

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
      return res.status(403).json({ message: 'You can only enroll in classes from your department.' });
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
        await sendFCMNotification(notificationMessage);
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

    // --- Notify Teacher and HOD ---
    const teacher = await User.findById(targetClass.teacher);
    const hod = await User.findById(targetClass.HOD);

    const recipients = [];
    if (teacher?.deviceToken) recipients.push(teacher);
    if (hod?.deviceToken) recipients.push(hod);

    for (const recipient of recipients) {
      const notificationMessage = {
        notification: {
          title: 'New Enrollment Request',
          body: `${student.name} has requested to enroll in ${targetClass.name}.`,
        },
        token: recipient.deviceToken,
      };
      await sendFCMNotification(notificationMessage);
      await Notification.create({
        recipient: recipient._id,
        type: 'enrollment_approved',
        title: 'New Enrollment Request',
        message: `${student.name} has requested to enroll in ${targetClass.name}.`,
        data: { enrollmentId: newEnrollment._id },
      });
    }

    res.status(201).json({ message: 'Enrollment request submitted successfully.', enrollment: newEnrollment });
  } catch (error) {
    console.error('Error requesting enrollment:', error);
    res.status(500).json({ message: 'Server error during enrollment request.' });
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

    // --- Notify Student ---
    if (enrollment.student.deviceToken) {
      const notificationMessage = {
        notification: {
          title: `Enrollment ${status}`,
          body: `Your request to enroll in ${targetClass.name} has been ${status.toLowerCase()}.`,
        },
        token: enrollment.student.deviceToken,
      };
      await sendFCMNotification(notificationMessage);
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
    const enrollments = await Enrollment.find().populate('student', 'name').populate('class', 'name');
    res.status(200).json(enrollments);
  } catch (error) {
    console.error('Error fetching all enrollments:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};
