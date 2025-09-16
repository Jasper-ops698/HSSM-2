const axios = require("axios");
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Advanced AI Report Generation with enhanced context and user authentication
const generateReport = async (req, res, next) => {
  try {
    // Check for authentication
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authentication required for AI report generation"
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found"
      });
    }

    const { userId, startDate, endDate } = req.body;
    if (!userId || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: userId, startDate, or endDate",
      });
    }

    // Verify user has permission to generate reports for this userId
    if (user.role !== 'admin' && user.role !== 'HSSM-provider' && user._id.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: "You don't have permission to generate reports for this user"
      });
    }

    const { Incident, Asset, Task, MeterReading, HospitalProfile } = require('../models/Hssm');

    const profile = await HospitalProfile.findOne({ userId });
    const incidents = await Incident.find({
      userId,
      date: { $gte: new Date(startDate), $lte: new Date(endDate) }
    });
    const assets = await Asset.find({ userId });
    const tasks = await Task.find({
      userId,
      dueDate: { $gte: new Date(startDate), $lte: new Date(endDate) }
    });
    const meterReadings = await MeterReading.find({
      userId,
      date: { $gte: new Date(startDate), $lte: new Date(endDate) }
    });

    // Enhanced prompt with more detailed context and user role consideration
    const userRole = user.role;
    const contextPrompt = `You are an expert AI assistant for Health Systems Support Management (HSSM). Generate a comprehensive technical and management report for a hospital facility.

USER CONTEXT:
- Requesting User: ${user.name} (${userRole})
- Target Facility User ID: ${userId}
- Report Period: ${startDate} to ${endDate}

FACILITY PROFILE:
- Mission: ${profile?.mission || 'Not specified'}
- Vision: ${profile?.vision || 'Not specified'}
- Service Charter: ${profile?.serviceCharter || 'Not specified'}
- Hospital Name: ${profile?.hospitalName || 'Not specified'}

OPERATIONAL DATA:
- Total Assets: ${assets.length}
- Incidents in Period: ${incidents.length}
- Tasks in Period: ${tasks.length}
- Meter Readings in Period: ${meterReadings.length}

DETAILED DATA:
Incidents: ${JSON.stringify(incidents.map(i => ({
  title: i.title,
  description: i.description,
  priority: i.priority,
  date: i.date,
  department: i.department
})), null, 2)}

Assets: ${JSON.stringify(assets.map(a => ({
  name: a.name,
  category: a.category,
  location: a.location,
  serialNumber: a.serialNumber
})), null, 2)}

Tasks: ${JSON.stringify(tasks.map(t => ({
  task: t.task,
  assignedTo: t.assignedTo,
  dueDate: t.dueDate,
  priority: t.priority,
  status: t.status
})), null, 2)}

Meter Readings: ${JSON.stringify(meterReadings.map(m => ({
  location: m.location,
  reading: m.reading,
  date: m.date
})), null, 2)}

Based on this comprehensive data, provide:

1. EXECUTIVE SUMMARY
   - Overall facility performance assessment
   - Key achievements and challenges

2. DETAILED ANALYSIS
   - Incident analysis and trends
   - Asset utilization and maintenance needs
   - Task completion rates and bottlenecks
   - Resource consumption patterns

3. ACTIONABLE RECOMMENDATIONS
   - Immediate priorities (next 30 days)
   - Medium-term improvements (3-6 months)
   - Long-term strategic initiatives

4. PREDICTIVE INSIGHTS
   - Future growth opportunities
   - Potential challenges and mitigation strategies
   - Resource planning recommendations

5. MANAGEMENT SUMMARY
   - Stakeholder communication points
   - Compliance and regulatory considerations
   - Performance metrics and KPIs

Format the response in clear sections with professional language suitable for management review.`;

    const aiResponse = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        contents: [{
          parts: [{
            text: contextPrompt
          }]
        }]
      },
      {
        headers: { "Content-Type": "application/json" },
        timeout: 60000 // 60 second timeout for complex reports
      }
    );

    if (aiResponse.data && aiResponse.data.candidates && aiResponse.data.candidates[0].content) {
      const reportContent = aiResponse.data.candidates[0].content.parts[0].text;

      // Save report to database for tracking
      const GeneratedReport = require('../models/Hssm').GeneratedReport;
      const savedReport = new GeneratedReport({
        title: `HSSM Report - ${new Date().toLocaleDateString()}`,
        markdownContent: reportContent,
        user: user._id,
        status: 'completed'
      });
      await savedReport.save();

      res.status(200).json({
        success: true,
        report: reportContent,
        reportId: savedReport._id,
        generatedAt: new Date(),
        generatedBy: user.name
      });
    } else {
      const errorMessage = aiResponse.data?.error?.message || "Failed to generate report: Unexpected AI response.";
      res.status(500).json({ success: false, message: errorMessage });
    }
  } catch (error) {
    console.error('Error in generateReport:', error);
    next(error);
  }
};

// Enhanced AI Chat with authentication and context awareness
const chatWithAI = async (req, res, next) => {
  try {
    // Check for authentication
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authentication required for AI chat"
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found"
      });
    }

    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ success: false, message: "Message is required." });
    }

    // Input validation and sanitization
    const sanitizedMessage = message.trim();
    if (sanitizedMessage.length === 0) {
      return res.status(400).json({ success: false, message: "Message cannot be empty." });
    }

    if (sanitizedMessage.length > 2000) {
      return res.status(400).json({ success: false, message: "Message is too long. Please keep it under 2000 characters." });
    }

    // Basic content filtering
    const blockedPatterns = [
      /<script/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /<iframe/i,
      /<object/i,
      /<embed/i
    ];

    for (const pattern of blockedPatterns) {
      if (pattern.test(sanitizedMessage)) {
        return res.status(400).json({ success: false, message: "Message contains invalid content." });
      }
    }

    console.log('AI Chat request from user:', user._id, sanitizedMessage);

    // Add user message to chat history
    user.chatMessages.push({
      sender: 'user',
      text: sanitizedMessage,
      timestamp: new Date()
    });

    // Enhanced context-aware prompt with user role and system knowledge
    const contextAwarePrompt = `You are an expert AI assistant for a Health Systems Support Management (HSSM) system.

USER CONTEXT:
- Name: ${user.name}
- Role: ${user.role}
- User ID: ${user._id}

SYSTEM CAPABILITIES:
You help users with:
- Hospital facility management (Levels 1-6)
- Asset tracking and maintenance
- Incident reporting and management
- Task scheduling and monitoring
- Meter reading analysis
- Report generation
- User profile management
- Two-factor authentication setup
- Class enrollment and management
- Dashboard navigation and features

AVAILABLE ENDPOINTS:
- /api/dashboard - User dashboard with system overview
- /api/classes - Class management (teachers) and enrollment (students)
- /api/hssm - Hospital facility management
- /api/reports - Generate comprehensive reports
- /api/chat - AI assistance (this conversation)
- /api/profile - User profile management
- /api/2fa - Two-factor authentication

RESPONSE GUIDELINES:
- Be helpful, professional, and context-aware
- Provide specific guidance based on user's role
- Include relevant endpoint suggestions when appropriate
- Keep responses clear and actionable
- If user asks about unavailable features, suggest alternatives

USER QUESTION: ${sanitizedMessage}

Please provide a comprehensive, helpful response that considers the user's role and system context.`;

    // Add retry logic for rate limit errors
    let response;
    let retryCount = 0;
    const maxRetries = 2;

    while (retryCount <= maxRetries) {
      try {
        response = await axios.post(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${process.env.GEMINI_API_KEY}`,
          {
            contents: [{
              parts: [{
                text: contextAwarePrompt
              }]
            }]
          },
          {
            headers: { "Content-Type": "application/json" },
            timeout: 30000
          }
        );
        break; // Success, exit retry loop
      } catch (error) {
        if (error.response?.status === 429 && retryCount < maxRetries) {
          retryCount++;
          const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff
          console.log(`Rate limit hit, retrying in ${delay}ms (attempt ${retryCount}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        throw error;
      }
    }

    if (response.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
      const reply = response.data.candidates[0].content.parts[0].text;

      // Add bot response to chat history
      user.chatMessages.push({
        sender: 'bot',
        text: reply,
        timestamp: new Date()
      });

      // Save the updated user with new messages
      await user.save();

      res.json({
        success: true,
        reply,
        userId: user._id,
        timestamp: new Date()
      });
    } else {
      console.error('Unexpected AI response structure:', response.data);

      // Add error message to chat history
      user.chatMessages.push({
        sender: 'bot',
        text: 'Got an invalid response from the AI service.',
        timestamp: new Date(),
        isError: true
      });
      await user.save();

      res.status(500).json({
        success: false,
        message: 'Got an invalid response from the AI service.'
      });
    }
  } catch (error) {
    console.error('Error in chatWithAI:', error);
    next(error);
  }
};

// Get AI usage statistics for admin users
const getAIStats = async (req, res, next) => {
  try {
    // Check for authentication and admin role
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authentication required"
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user || user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: "Admin access required"
      });
    }

    // Get AI usage statistics
    const GeneratedReport = require('../models/Hssm').GeneratedReport;
    const totalReports = await GeneratedReport.countDocuments();
    const recentReports = await GeneratedReport.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('user', 'name role');

    // Get chat statistics
    const allUsers = await User.find({}, 'chatMessages name role');
    let totalChatMessages = 0;
    let totalUsersWithChats = 0;

    allUsers.forEach(user => {
      if (user.chatMessages && user.chatMessages.length > 0) {
        totalChatMessages += user.chatMessages.length;
        totalUsersWithChats++;
      }
    });

    res.json({
      success: true,
      stats: {
        totalReports,
        totalChatMessages,
        totalUsersWithChats,
        recentReports: recentReports.map(report => ({
          id: report._id,
          title: report.title,
          user: report.user?.name || 'Unknown',
          userRole: report.user?.role || 'Unknown',
          createdAt: report.createdAt,
          status: report.status
        }))
      }
    });
  } catch (error) {
    console.error('Error in getAIStats:', error);
    next(error);
  }
};

module.exports = {
  generateReport,
  chatWithAI,
  getAIStats,
};
