const axios = require('axios');

// Test script for AI-powered student assessment features
const BASE_URL = 'http://localhost:5000/api/gemini';

class AITester {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
  }

  async testStudentAssessment(studentId) {
    try {
      console.log('🔍 Testing Student Assessment...');
      const response = await axios.post(`${this.baseUrl}/assess-student`, {
        studentId: studentId
      });

      console.log('✅ Student Assessment Results:');
      console.log('Student:', response.data.studentData.name);
      console.log('Engagement Level:', response.data.assessment.engagementLevel);
      console.log('Completion Readiness:', response.data.assessment.completionReadiness);
      console.log('AI Analysis Preview:', response.data.aiAnalysis.substring(0, 200) + '...');

      return response.data;
    } catch (error) {
      console.error('❌ Student Assessment Test Failed:', error.response?.data || error.message);
    }
  }

  async testPDFGeneration(studentId) {
    try {
      console.log('📄 Testing PDF Report Generation...');
      const response = await axios.post(`${this.baseUrl}/generate-student-pdf`, {
        studentId: studentId
      });

      console.log('✅ PDF Generation Results:');
      console.log('File Name:', response.data.fileName);
      console.log('Download URL:', response.data.downloadUrl);
      console.log('Message:', response.data.message);

      return response.data;
    } catch (error) {
      console.error('❌ PDF Generation Test Failed:', error.response?.data || error.message);
    }
  }

  async testStudentInsights(studentId) {
    try {
      console.log('📊 Testing Student Insights...');
      const response = await axios.get(`${this.baseUrl}/student-insights/${studentId}`);

      console.log('✅ Student Insights Results:');
      console.log('Student:', response.data.student.name);
      console.log('Total Enrollments:', response.data.statistics.totalEnrollments);
      console.log('Attendance Rate:', response.data.statistics.attendanceRate + '%');
      console.log('AI Insights Preview:', response.data.aiInsights.substring(0, 150) + '...');

      return response.data;
    } catch (error) {
      console.error('❌ Student Insights Test Failed:', error.response?.data || error.message);
    }
  }

  async testNotifications() {
    try {
      console.log('🔔 Testing Notification System...');
      const response = await axios.post(`${this.baseUrl}/trigger-notifications`);

      console.log('✅ Notification Test Results:');
      console.log('Success:', response.data.success);
      console.log('Message:', response.data.message);

      return response.data;
    } catch (error) {
      console.error('❌ Notification Test Failed:', error.response?.data || error.message);
    }
  }

  async testSchedulerStatus() {
    try {
      console.log('⏰ Checking Scheduler Status...');
      const response = await axios.get(`${this.baseUrl}/scheduler-status`);

      console.log('✅ Scheduler Status:');
      console.log('Active Schedulers:', response.data.activeSchedulers);
      console.log('Count:', response.data.count);

      return response.data;
    } catch (error) {
      console.error('❌ Scheduler Status Check Failed:', error.response?.data || error.message);
    }
  }

  async runAllTests(studentId) {
    console.log('🚀 Starting AI Features Test Suite...\n');

    await this.testSchedulerStatus();
    console.log('');

    await this.testStudentAssessment(studentId);
    console.log('');

    await this.testStudentInsights(studentId);
    console.log('');

    await this.testPDFGeneration(studentId);
    console.log('');

    await this.testNotifications();
    console.log('');

    console.log('🎉 Test Suite Complete!');
  }
}

// Usage example
// Replace 'YOUR_STUDENT_ID' with an actual student ID from your database
const tester = new AITester(BASE_URL);

// To run all tests:
// tester.runAllTests('YOUR_STUDENT_ID');

// To run individual tests:
// tester.testStudentAssessment('YOUR_STUDENT_ID');
// tester.testPDFGeneration('YOUR_STUDENT_ID');
// tester.testStudentInsights('YOUR_STUDENT_ID');
// tester.testNotifications();
// tester.testSchedulerStatus();

module.exports = AITester;
