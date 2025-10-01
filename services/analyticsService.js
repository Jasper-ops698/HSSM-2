const User = require('../models/User');
const Enrollment = require('../models/Enrollment');
const Absence = require('../models/Absence');
const Class = require('../models/Class');

/**
 * Analyzes the interaction data for a specific student.
 * This service can be used for generating reports and for AI-powered insights.
 * @param {string} studentId The ID of the student to analyze.
 * @returns {Promise<object>} An object containing detailed analysis of the student's interactions.
 */
async function analyzeStudentInteraction(studentId) {
  try {
    const student = await User.findById(studentId).lean();
    if (!student || student.role !== 'student') {
      throw new Error('Student not found.');
    }

    // 1. Get all enrollments for the student
    const enrollments = await Enrollment.find({ student: studentId }).populate({
      path: 'class',
      populate: {
        path: 'teacher',
        select: 'name email', // Populate teacher details
      },
    }).lean();

    if (enrollments.length === 0) {
      return {
        student,
        summary: {
          totalEnrolled: 0,
          attendancePercentage: 100, // No classes, so no absences
          message: 'Student has not enrolled in any classes yet.',
        },
        enrolledClasses: [],
      };
    }

    // 2. Get all absence records for the student
    const absences = await Absence.find({ student: studentId }).lean();
    const absenceClassIds = new Set(absences.map(a => a.class.toString()));

    // 3. Calculate attendance for each class. Normalize class IDs to strings and
    // avoid depending on populated objects downstream.
    const enrolledClasses = enrollments.map(enrollment => {
      const classInfo = enrollment.class || {};
      const classIdStr = classInfo._id ? String(classInfo._id) : String(classInfo);
      const totalAbsences = absences.filter(a => a.class && String(a.class) === classIdStr).length;
      // Simplified sessions assumption
      const totalSessions = 30;
      const attendance = Math.max(0, totalSessions - totalAbsences);
      const attendancePercentage = (attendance / totalSessions) * 100;

      return {
        className: classInfo.name || 'Unknown',
        classId: classIdStr,
        teacher: classInfo.teacher || null,
        totalAbsences,
        attendancePercentage: parseFloat(attendancePercentage.toFixed(2)),
      };
    });

    const overallTotalAbsences = absences.length;
    const overallTotalSessions = enrolledClasses.length * 30; // Simplified
    const overallAttendancePercentage = (Math.max(0, overallTotalSessions - overallTotalAbsences) / overallTotalSessions) * 100;

    // 4. Prepare the summary
    const summary = {
      totalEnrolled: enrolledClasses.length,
      overallAttendancePercentage: parseFloat(overallAttendancePercentage.toFixed(2)),
      message: `Analysis complete. Found ${enrolledClasses.length} enrolled classes and ${overallTotalAbsences} total absences.`,
      // This is where you would call an AI model to generate a narrative summary
      aiNarrative: `(Placeholder) An AI-generated summary of the student's performance would appear here.`,
    };

    return {
      student,
      summary,
      enrolledClasses,
    };

  } catch (error) {
    console.error(`Error in analyzeStudentInteraction for student ${studentId}:`, error);
    throw error;
  }
}

module.exports = { analyzeStudentInteraction };
