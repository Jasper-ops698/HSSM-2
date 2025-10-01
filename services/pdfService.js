const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

class PDFService {
  static async generateStudentInteractionReport(studentData, analysisData) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument();
        const fileName = `student_interaction_report_${studentData._id}_${Date.now()}.pdf`;
        const filePath = path.join(__dirname, '../uploads', fileName);

        // Ensure uploads directory exists
        if (!fs.existsSync(path.dirname(filePath))) {
          fs.mkdirSync(path.dirname(filePath), { recursive: true });
        }

        const stream = fs.createWriteStream(filePath);
        doc.pipe(stream);

        // Header
        doc.fontSize(20).text('Student-Teacher Interaction Report', { align: 'center' });
        doc.moveDown();
        doc.fontSize(14).text(`Generated on: ${new Date().toLocaleDateString()}`, { align: 'center' });
        doc.moveDown(2);

        // Student Information
        doc.fontSize(16).text('Student Information');
        doc.moveDown();
        doc.fontSize(12)
          .text(`Name: ${studentData.name}`)
          .text(`Email: ${studentData.email}`)
          .text(`Department: ${studentData.department || 'N/A'}`)
          .text(`Role: ${studentData.role}`);
        doc.moveDown();

        // Summary Statistics
        doc.fontSize(16).text('Summary Statistics');
        doc.moveDown();
        const enrolledClassesSafe = Array.isArray(analysisData.enrolledClasses) ? analysisData.enrolledClasses : [];
        const totalAbsences = enrolledClassesSafe.reduce((sum, cls) => sum + (cls.totalAbsences || 0), 0);
        doc.fontSize(12)
          .text(`Total Classes Enrolled: ${analysisData.summary.totalEnrolled}`)
          .text(`Overall Attendance Percentage: ${analysisData.summary.overallAttendancePercentage}%`)
          .text(`Total Absences: ${totalAbsences}`);
        doc.moveDown();

        // Class Details
        doc.fontSize(16).text('Class Details');
        doc.moveDown();

        (Array.isArray(analysisData.enrolledClasses) ? analysisData.enrolledClasses : []).forEach((classInfo, index) => {
          doc.fontSize(14).text(`${index + 1}. ${classInfo.className}`);
          doc.fontSize(12)
            .text(`   Teacher: ${classInfo.teacher?.name || 'N/A'}`)
            .text(`   Attendance Percentage: ${classInfo.attendancePercentage}%`)
            .text(`   Total Absences: ${classInfo.totalAbsences}`);
          doc.moveDown();
        });

        // AI Analysis Section
        if (analysisData.aiAnalysis) {
          doc.moveDown();
          doc.fontSize(16).text('AI Analysis & Recommendations');
          doc.moveDown();
          doc.fontSize(12).text(analysisData.aiAnalysis, {
            align: 'justify',
            lineGap: 5
          });
        }

        // Footer
        doc.moveDown(2);
        doc.fontSize(10).text('This report was generated automatically by the MultiShop Education System', { align: 'center' });

        doc.end();

        stream.on('finish', () => {
          resolve({ fileName, filePath });
        });

        stream.on('error', (error) => {
          reject(error);
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  static async generateHODSummaryReport(studentsData, department) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument();
        const fileName = `hod_summary_report_${department}_${Date.now()}.pdf`;
        const filePath = path.join(__dirname, '../uploads', fileName);

        // Ensure uploads directory exists
        if (!fs.existsSync(path.dirname(filePath))) {
          fs.mkdirSync(path.dirname(filePath), { recursive: true });
        }

        const stream = fs.createWriteStream(filePath);
        doc.pipe(stream);

        // Header
        doc.fontSize(20).text('HOD Summary Report - Student Performance', { align: 'center' });
        doc.moveDown();
        doc.fontSize(14).text(`Department: ${department}`, { align: 'center' });
        doc.fontSize(12).text(`Generated on: ${new Date().toLocaleDateString()}`, { align: 'center' });
        doc.moveDown(2);

        // Summary Statistics
        const totalStudents = studentsData.length;
        const avgAttendance = studentsData.reduce((sum, student) => sum + student.summary.overallAttendancePercentage, 0) / totalStudents;
        const excellentStudents = studentsData.filter(s => s.summary.overallAttendancePercentage >= 90).length;
        const poorStudents = studentsData.filter(s => s.summary.overallAttendancePercentage < 70).length;

        doc.fontSize(16).text('Department Overview');
        doc.moveDown();
        doc.fontSize(12)
          .text(`Total Students: ${totalStudents}`)
          .text(`Average Attendance: ${avgAttendance.toFixed(2)}%`)
          .text(`Excellent Performers (≥90%): ${excellentStudents}`)
          .text(`Students Needing Attention (<70%): ${poorStudents}`);
        doc.moveDown();

        // Student Details Table
        doc.fontSize(16).text('Student Performance Details');
        doc.moveDown();

        studentsData.forEach((student, index) => {
          doc.fontSize(14).text(`${index + 1}. ${student.student.name}`);
          doc.fontSize(12)
            .text(`   Classes Enrolled: ${student.summary.totalEnrolled}`)
            .text(`   Overall Attendance: ${student.summary.overallAttendancePercentage}%`)
            .text(`   Status: ${student.summary.overallAttendancePercentage >= 90 ? 'Excellent' :
              student.summary.overallAttendancePercentage >= 70 ? 'Good' : 'Needs Improvement'}`);
          doc.moveDown();
        });

        // Footer
        doc.moveDown(2);
        doc.fontSize(10).text('This report was generated automatically by the MultiShop Education System', { align: 'center' });

        doc.end();

        stream.on('finish', () => {
          resolve({ fileName, filePath });
        });

        stream.on('error', (error) => {
          reject(error);
        });

      } catch (error) {
        reject(error);
      }
    });
  }
}

module.exports = PDFService;
