const Notification = require('../models/Notification');
const User = require('../models/User');
const { analyzeStudentInteraction } = require('./analyticsService');

class NotificationService {
  static async sendPeriodicStudentNotifications() {
    try {
      // Get all students
      const students = await User.find({ role: 'student' });

      for (const student of students) {
        const analysis = await analyzeStudentInteraction(student._id);

        // Create notification based on performance
        let notificationType = 'class_enrollment';
        let title = 'Weekly Performance Update';
        let message = '';

        if (analysis.summary.overallAttendancePercentage >= 90) {
          message = `Excellent work! Your attendance is ${analysis.summary.overallAttendancePercentage}%. Keep it up!`;
        } else if (analysis.summary.overallAttendancePercentage >= 70) {
          message = `Your attendance is ${analysis.summary.overallAttendancePercentage}%. Consider improving to maintain good standing.`;
        } else {
          notificationType = 'admin_alert';
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
      }

      console.log(`Sent periodic notifications to ${students.length} students`);
    } catch (error) {
      console.error('Error sending periodic student notifications:', error);
    }
  }

  static async sendTeacherNotifications() {
    try {
      // Get all teachers
      const teachers = await User.find({ role: 'service-provider' }); // teachers are service-providers

      for (const teacher of teachers) {
        // Get classes taught by this teacher
        const Class = require('../models/Class');
        const classes = await Class.find({ teacher: teacher._id }).populate('enrolledStudents');

        const totalStudents = classes.reduce((sum, cls) => sum + cls.enrolledStudents.length, 0);

        await Notification.create({
          recipient: teacher._id,
          type: 'timetable_update',
          title: 'Weekly Teaching Summary',
          message: `You are teaching ${classes.length} classes with ${totalStudents} total students enrolled.`,
          data: {
            classesCount: classes.length,
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
        // Get department statistics
        const department = hod.department;
        const students = await User.find({ role: 'student', department });
        const totalStudents = students.length;

        // Calculate department performance
        let excellentCount = 0;
        let poorCount = 0;

        for (const student of students) {
          const analysis = await analyzeStudentInteraction(student._id);
          if (analysis.summary.overallAttendancePercentage >= 90) excellentCount++;
          if (analysis.summary.overallAttendancePercentage < 70) poorCount++;
        }

        await Notification.create({
          recipient: hod._id,
          type: 'admin_alert',
          title: 'Department Performance Summary',
          message: `Department ${department}: ${totalStudents} students, ${excellentCount} excellent performers, ${poorCount} need attention.`,
          data: {
            department,
            totalStudents,
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

  static async sendAllPeriodicNotifications() {
    await Promise.all([
      this.sendPeriodicStudentNotifications(),
      this.sendTeacherNotifications(),
      this.sendHODNotifications()
    ]);
  }
}

module.exports = NotificationService;
