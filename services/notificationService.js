const Notification = require('../models/Notification');
const User = require('../models/User');
const Class = require('../models/Class');
const { analyzeStudentInteraction } = require('./analyticsService');

class NotificationService {
  static async sendAllPeriodicNotifications() {
    try {
      console.log('Starting periodic notifications...');
      
      // Send notifications to different user types
      await this.sendStudentNotifications();
      await this.sendTeacherNotifications();
      await this.sendHODNotifications();
      await this.sendAdminNotifications();
      
      console.log('All periodic notifications sent successfully');
    } catch (error) {
      console.error('Error sending all periodic notifications:', error);
    }
  }

  static async sendStudentNotifications() {
    try {
      // Get all students
      const students = await User.find({ role: 'student' });

      for (const student of students) {
        try {
          const analysis = await analyzeStudentInteraction(student._id);

          // Create notification based on performance
          let notificationType = 'performance_update';
          let title = 'Weekly Performance Update';
          let message = '';

          if (analysis.summary.overallAttendancePercentage >= 90) {
            message = `Excellent work! Your attendance is ${analysis.summary.overallAttendancePercentage}%. Keep it up!`;
          } else if (analysis.summary.overallAttendancePercentage >= 70) {
            message = `Your attendance is ${analysis.summary.overallAttendancePercentage}%. Consider improving to maintain good standing.`;
          } else {
            notificationType = 'student_absence';
            title = 'Attendance Alert';
            message = `Your attendance is ${analysis.summary.overallAttendancePercentage}%. Please contact your HOD for support.`;
          }

          await Notification.create({
            recipient: student._id,
            type: notificationType,
            title,
            message,
            data: {
              attendancePercentage: analysis.summary.overallAttendancePercentage,
              totalEnrolled: analysis.summary.totalEnrolled
            }
          });
        } catch (error) {
          console.error(`Error analyzing student ${student._id}:`, error);
          // Send a generic notification if analytics fails
          await Notification.create({
            recipient: student._id,
            type: 'performance_update',
            title: 'Weekly Update',
            message: 'Your weekly performance summary is being prepared. Please check back later.',
            data: {}
          });
        }
      }

      console.log(`Sent periodic notifications to ${students.length} students`);
    } catch (error) {
      console.error('Error sending periodic student notifications:', error);
    }
  }

  static async sendAdminNotifications() {
    try {
      // Get all admins
      const admins = await User.find({ role: 'admin' });

      // Get system-wide statistics
      const totalStudents = await User.countDocuments({ role: 'student' });
      const totalTeachers = await User.countDocuments({ role: 'teacher' });
      const totalClasses = await Class.countDocuments();

      for (const admin of admins) {
        await Notification.create({
          recipient: admin._id,
          type: 'admin_alert',
          title: 'Weekly System Report',
          message: `System Overview: ${totalStudents} students, ${totalTeachers} teachers, ${totalClasses} classes.`,
          data: {
            totalStudents,
            totalTeachers,
            totalClasses
          }
        });
      }

      console.log(`Sent notifications to ${admins.length} admins`);
    } catch (error) {
      console.error('Error sending admin notifications:', error);
    }
  }

  static async sendTeacherNotifications() {
    try {
      // Get all teachers
      const teachers = await User.find({ role: 'teacher' });

      for (const teacher of teachers) {
        // Get classes taught by this teacher
        const classes = await Class.find({ teacher: teacher._id }).populate('enrolledStudents');

        const totalStudents = classes.reduce((sum, cls) => sum + cls.enrolledStudents.length, 0);
        const totalClasses = classes.length;

        await Notification.create({
          recipient: teacher._id,
          type: 'timetable_update',
          title: 'Weekly Teaching Summary',
          message: `You are teaching ${totalClasses} classes with ${totalStudents} total students enrolled.`,
          data: {
            classesCount: totalClasses,
            totalStudents
          }
        });
      }

      console.log(`Sent notifications to ${teachers.length} teachers`);
    } catch (error) {
      console.error('Error sending teacher notifications:', error);
    }
  }

  static async sendHODNotifications() {
    try {
      // Get all HODs
      const hods = await User.find({ role: 'HOD' });

      for (const hod of hods) {
        // Skip HODs without departments
        if (!hod.department) {
          console.warn(`HOD ${hod._id} has no department assigned`);
          continue;
        }

        // Get department statistics
        const department = hod.department;
        const students = await User.find({ role: 'student', department });
        const teachers = await User.find({ role: 'teacher', department });
        const classes = await Class.find({ department });
        
        const totalStudents = students.length;
        const totalTeachers = teachers.length;
        const totalClasses = classes.length;

        // Calculate department performance
        let excellentCount = 0;
        let poorCount = 0;

        for (const student of students) {
          try {
            const analysis = await analyzeStudentInteraction(student._id);
            if (analysis.summary.overallAttendancePercentage >= 90) excellentCount++;
            if (analysis.summary.overallAttendancePercentage < 70) poorCount++;
          } catch (error) {
            console.error(`Error analyzing student ${student._id} for HOD report:`, error);
          }
        }

        await Notification.create({
          recipient: hod._id,
          type: 'admin_alert',
          title: 'Department Weekly Report',
          message: `Department ${department}: ${totalStudents} students, ${totalTeachers} teachers, ${totalClasses} classes. ${excellentCount} excellent performers, ${poorCount} need attention.`,
          data: {
            department,
            totalStudents,
            totalTeachers,
            totalClasses,
            excellentCount,
            poorCount
          }
        });
      }

      console.log(`Sent notifications to ${hods.length} HODs`);
    } catch (error) {
      console.error('Error sending HOD notifications:', error);
    }
  }

  static async sendCreditNotification(userId, amount, action) {
    try {
      const user = await User.findById(userId);
      if (!user) return;

      const message = action === 'add' 
        ? `You have been credited ${amount} credits. New balance: ${user.credits}.`
        : `You have been debited ${amount} credits. New balance: ${user.credits}.`;

      await Notification.create({
        recipient: userId,
        type: 'credit_update',
        title: 'Credit Update',
        message,
        data: {
          amount,
          action,
          newBalance: user.credits
        }
      });

      console.log(`Sent credit notification to ${user.name}`);
    } catch (error) {
      console.error('Error sending credit notification:', error);
    }
  }

  static async notifyCreditControllers(studentName, className, creditsDeducted) {
    try {
      const creditControllers = await User.find({ role: 'credit-controller' });

      for (const controller of creditControllers) {
        await Notification.create({
          recipient: controller._id,
          type: 'credit_deduction',
          title: 'Credit Deduction for Enrollment',
          message: `${studentName} used ${creditsDeducted} credits to enroll in ${className}.`,
          data: {
            studentName,
            className,
            creditsDeducted
          }
        });
      }

      console.log(`Notified ${creditControllers.length} credit-controllers`);
    } catch (error) {
      console.error('Error notifying credit-controllers:', error);
    }
  }

  static async notifyTimetableUpdate(department, uploadedBy) {
    try {
      console.log(`Sending timetable update notifications for ${department} department`);

      // Get all students in the department
      const students = await User.find({
        role: 'student',
        department: department
      });

      // Get all teachers in the department
      const teachers = await User.find({
        role: 'teacher',
        department: department
      });

      // Send notifications to students
      for (const student of students) {
        await Notification.create({
          recipient: student._id,
          type: 'timetable_update',
          title: 'Timetable Updated',
          message: `The timetable for ${department} department has been updated. Please check your schedule for any changes.`,
          data: {
            department,
            updatedBy: uploadedBy,
            updateType: 'timetable'
          }
        });
      }

      // Send notifications to teachers
      for (const teacher of teachers) {
        await Notification.create({
          recipient: teacher._id,
          type: 'timetable_update',
          title: 'Timetable Updated',
          message: `The timetable for ${department} department has been updated. Your teaching schedule may have changed.`,
          data: {
            department,
            updatedBy: uploadedBy,
            updateType: 'timetable'
          }
        });
      }

      console.log(`Sent timetable update notifications to ${students.length} students and ${teachers.length} teachers in ${department} department`);
    } catch (error) {
      console.error('Error sending timetable update notifications:', error);
    }
  }

  static async notifyVenueUpdate(timetableEntry) {
    try {
      const { subject, teacher, venue, dayOfWeek, startTime, endTime, department } = timetableEntry;

      // Find all students in the department
      const students = await User.find({ department, role: 'student' });

      const notificationPromises = students.map(student => {
        return Notification.create({
          recipient: student._id,
          type: 'venue_update',
          title: `Venue Change for ${subject}`,
          message: `The venue for ${subject} on ${dayOfWeek} at ${startTime} has been changed to ${venue.name}.`,
          data: {
            subject,
            teacher: teacher.name,
            venue: venue.name,
            dayOfWeek,
            startTime,
            endTime,
          }
        });
      });

      await Promise.all(notificationPromises);
      console.log(`Sent venue update notifications for ${subject} to ${students.length} students.`);
    } catch (error) {
      console.error('Error sending venue update notifications:', error);
    }
  }
}

module.exports = NotificationService;
