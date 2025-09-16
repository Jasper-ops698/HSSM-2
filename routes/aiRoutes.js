const express = require('express');
const router = express.Router();
const { generateReport, chatWithAI, getAIStats } = require('../controllers/aiController');

// Middleware to authenticate user
const authenticateUser = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ success: false, message: 'No token provided' });
  }

  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

// Middleware to check admin role
const requireAdmin = async (req, res, next) => {
  try {
    const User = require('../models/User');
    const user = await User.findById(req.userId);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }
    req.user = user;
    next();
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Route for generating AI reports (authenticated)
router.post('/report', authenticateUser, generateReport);

// Route for AI chat (authenticated)
router.post('/chat', authenticateUser, chatWithAI);

// Route for AI statistics (admin only)
router.get('/stats', authenticateUser, requireAdmin, getAIStats);

// Health check endpoint for AI service
router.get('/health', (req, res) => {
  const isConfigured = !!process.env.GEMINI_API_KEY;
  res.json({
    success: true,
    service: 'Advanced AI Service',
    status: isConfigured ? 'configured' : 'not_configured',
    model: 'gemini-1.5-pro',
    features: ['report_generation', 'contextual_chat', 'usage_statistics'],
    timestamp: new Date().toISOString()
  });
});

// Test endpoint to verify Gemini API key
router.get('/test', async (req, res) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        success: false,
        message: 'GEMINI_API_KEY not configured'
      });
    }

    const axios = require('axios');
    const testResponse = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        contents: [{
          parts: [{
            text: 'Hello! This is a test of the advanced AI system. Please respond with a brief confirmation that the system is working properly.'
          }]
        }]
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      }
    );

    if (testResponse.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
      res.json({
        success: true,
        message: 'Advanced AI system test successful',
        response: testResponse.data.candidates[0].content.parts[0].text,
        model: 'gemini-1.5-pro'
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Unexpected API response format'
      });
    }
  } catch (error) {
    console.error('Advanced AI test error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Advanced AI system test failed',
      error: error.message
    });
  }
});

module.exports = router;
