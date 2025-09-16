const express = require('express');
const axios = require('axios');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const router = express.Router();

// Middleware to authenticate user
const authenticateUser = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

// Rate limiter for chat: 5 requests per minute per IP (reduced from 10)
const chatLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 5, // Limit each IP to 5 requests per windowMs (reduced from 10)
  message: { success: false, reply: 'Too many chat requests. Please wait a minute before trying again.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Health check endpoint for chat service
router.get('/health', async (req, res) => {
  try {
    const isConfigured = !!process.env.GEMINI_API_KEY;

    res.json({
      success: true,
      service: 'Chat AI',
      status: isConfigured ? 'configured' : 'not_configured',
      timestamp: new Date().toISOString(),
      rateLimit: {
        requestsPerMinute: 5,
        windowMs: 60000
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      service: 'Chat AI',
      status: 'error',
      error: error.message
    });
  }
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

    const testResponse = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        contents: [
          {
            parts: [
              {
                text: 'Hello, this is a test message. Please respond with "API test successful".'
              }
            ]
          }
        ]
      },
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );

    if (testResponse.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
      res.json({
        success: true,
        message: 'Gemini API test successful',
        response: testResponse.data.candidates[0].content.parts[0].text
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Unexpected API response format'
      });
    }
  } catch (error) {
    console.error('Gemini API test error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Gemini API test failed',
      error: error.message
    });
  }
});

// Main chat endpoint with rate limiting and user authentication
router.post('/', authenticateUser, chatLimiter, async (req, res) => {
  try {
    const { message } = req.body;
    const user = req.user;

    if (!message) {
      return res.status(400).json({ success: false, reply: 'Message is required.' });
    }

    // Input validation and sanitization
    const sanitizedMessage = message.trim();
    if (sanitizedMessage.length === 0) {
      return res.status(400).json({ success: false, reply: 'Message cannot be empty.' });
    }

    if (sanitizedMessage.length > 2000) {
      return res.status(400).json({ success: false, reply: 'Message is too long. Please keep it under 2000 characters.' });
    }

    // Basic content filtering (you can expand this)
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
        return res.status(400).json({ success: false, reply: 'Message contains invalid content.' });
      }
    }

    console.log('Received chat message from user:', user._id, sanitizedMessage);

    // Add user message to chat history
    user.chatMessages.push({
      sender: 'user',
      text: sanitizedMessage,
      timestamp: new Date()
    });

    // Check if API key is available
    if (!process.env.GEMINI_API_KEY) {
      console.error('GEMINI_API_KEY not found in environment variables');
      return res.status(500).json({ 
        success: false, 
        reply: 'AI service is not properly configured. Please try again later.' 
      });
    }

    const contextAwarePrompt = `You are a helpful assistant for a Health Systems Support Management (HSSM) system. 
    The system manages hospital services across different levels (1-6), assets, incidents, and maintenance tasks. 
    You also guide users on how to use the application. This includes:
    - How to navigate the dashboard.
    - How to enroll in classes.
    - How to manage classes (for teachers).
    - How to use the reporting features (for HSSM providers).
    - How to manage their profile and 2FA settings.
    
    User's question: ${sanitizedMessage}`;

    console.log('Making request to Gemini API...');

    // Add retry logic for rate limit errors
    let response;
    let retryCount = 0;
    const maxRetries = 2;

    while (retryCount <= maxRetries) {
      try {
        response = await axios.post(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${process.env.GEMINI_API_KEY}`,
          {
            contents: [
              {
                parts: [
                  {
                    text: contextAwarePrompt
                  }
                ]
              }
            ]
          },
          {
            headers: {
              'Content-Type': 'application/json'
            },
            timeout: 30000 // 30 second timeout
          }
        );
        break; // Success, exit retry loop
      } catch (error) {
        if (error.response?.status === 429 && retryCount < maxRetries) {
          retryCount++;
          const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff: 2s, 4s
          console.log(`Rate limit hit, retrying in ${delay}ms (attempt ${retryCount}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        throw error; // Re-throw if not a rate limit or max retries reached
      }
    }

    console.log('Gemini API response received');

    if (response.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
      const reply = response.data.candidates[0].content.parts[0].text;
      console.log('Successfully extracted reply from Gemini response');

      // Add bot response to chat history
      user.chatMessages.push({
        sender: 'bot',
        text: reply,
        timestamp: new Date()
      });

      // Save the updated user with new messages
      await user.save();

      res.json({ success: true, reply });
    } else {
      console.error('Unexpected API response structure:', response.data);

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
        reply: 'Got an invalid response from the AI service.' 
      });
    }
  } catch (error) {
    console.error('Error in chat route:', {
      message: error.message,
      status: error.response?.status,
      userId: req.user?._id,
      timestamp: new Date().toISOString()
    });

    const user = req.user;

    if (error.response) {
      console.error('Gemini API error response:', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      });
      
      if (error.response.status === 400) {
        const errorMsg = 'Invalid request to AI service. Please try rephrasing your question.';
        if (user) {
          user.chatMessages.push({
            sender: 'bot',
            text: errorMsg,
            timestamp: new Date(),
            isError: true
          });
          await user.save();
        }
        return res.status(500).json({ 
          success: false, 
          reply: errorMsg
        });
      } else if (error.response.status === 403) {
        const errorMsg = 'AI service access denied. The service may be temporarily unavailable.';
        if (user) {
          user.chatMessages.push({
            sender: 'bot',
            text: errorMsg,
            timestamp: new Date(),
            isError: true
          });
          await user.save();
        }
        return res.status(500).json({ 
          success: false, 
          reply: errorMsg
        });
      } else if (error.response.status === 429) {
        console.error('Gemini API rate limit exceeded for user:', user?._id);

        // Provide helpful fallback responses based on common questions
        const fallbackResponses = {
          'dashboard': 'You can access your dashboard from the main navigation menu. It shows an overview of your classes, assignments, and system status.',
          'profile': 'To update your profile, go to Settings > Profile. You can change your personal information, password, and enable two-factor authentication.',
          'classes': 'To view your classes, navigate to the Classes section. Teachers can create and manage classes, while students can enroll and view assignments.',
          'reports': 'HSSM providers can generate reports from the Reports section. This includes incident reports, asset management, and maintenance tracking.',
          'help': 'I\'m here to help! You can ask me about navigating the system, managing classes, generating reports, or updating your profile.',
          'default': 'The AI assistant is currently busy. Please try again in a few minutes, or check our documentation for common questions and answers.'
        };

        const message = sanitizedMessage.toLowerCase();
        let fallbackReply = fallbackResponses.default;

        for (const [key, response] of Object.entries(fallbackResponses)) {
          if (key !== 'default' && message.includes(key)) {
            fallbackReply = response;
            break;
          }
        }

        if (user) {
          user.chatMessages.push({
            sender: 'bot',
            text: fallbackReply,
            timestamp: new Date(),
            isError: true
          });
          await user.save();
        }

        return res.status(429).json({
          success: false,
          reply: fallbackReply,
          retryAfter: 60,
          note: 'AI service temporarily unavailable due to high demand'
        });
      }
    } else if (error.code === 'ECONNABORTED') {
      console.error('Gemini API request timeout for user:', user?._id);
      const errorMsg = 'AI service is taking too long to respond. Please try again in a moment.';
      if (user) {
        user.chatMessages.push({
          sender: 'bot',
          text: errorMsg,
          timestamp: new Date(),
          isError: true
        });
        await user.save();
      }
      return res.status(500).json({ 
        success: false, 
        reply: errorMsg
      });
    }

    const errorMsg = 'The AI assistant is currently unavailable. Please try again later or contact support if the issue persists.';
    if (user) {
      user.chatMessages.push({
        sender: 'bot',
        text: errorMsg,
        timestamp: new Date(),
        isError: true
      });
      await user.save();
    }

    res.status(500).json({ 
      success: false, 
      reply: errorMsg
    });
  }
});

// Get user's chat history
router.get('/history', authenticateUser, async (req, res) => {
  try {
    const user = req.user;
    const limit = parseInt(req.query.limit) || 50; // Default to last 50 messages
    const skip = parseInt(req.query.skip) || 0;

    // Get chat messages sorted by timestamp (oldest first for proper pagination)
    const allMessages = user.chatMessages
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    // Calculate pagination
    const totalMessages = allMessages.length;
    const startIndex = Math.max(0, totalMessages - skip - limit);
    const endIndex = Math.max(0, totalMessages - skip);
    
    // Get the messages for this page (most recent messages first)
    const messages = allMessages.slice(startIndex, endIndex);

    res.json({
      success: true,
      messages,
      total: totalMessages,
      hasMore: skip < totalMessages - limit
    });
  } catch (error) {
    console.error('Error getting chat history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve chat history'
    });
  }
});

// Clear user's chat history
router.delete('/history', authenticateUser, async (req, res) => {
  try {
    const user = req.user;
    user.chatMessages = [];
    await user.save();

    res.json({
      success: true,
      message: 'Chat history cleared successfully'
    });
  } catch (error) {
    console.error('Error clearing chat history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clear chat history'
    });
  }
});

// Public chat endpoint for navigation questions (no authentication required)
router.post('/public', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ success: false, message: "Message is required." });
    }

    // Input validation and sanitization
    const sanitizedMessage = message.trim();
    if (sanitizedMessage.length === 0) {
      return res.status(400).json({ success: false, message: "Message cannot be empty." });
    }

    if (sanitizedMessage.length > 500) { // Shorter limit for public chat
      return res.status(400).json({ success: false, message: "Message is too long. Please keep it under 500 characters." });
    }

    // Basic content filtering (stricter for public)
    const blockedPatterns = [
      /<script/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /<iframe/i,
      /<object/i,
      /<embed/i,
      /password/i,
      /login/i,
      /account/i,
      /personal/i,
      /private/i
    ];

    for (const pattern of blockedPatterns) {
      if (pattern.test(sanitizedMessage)) {
        return res.status(400).json({
          success: false,
          message: "This topic is not available in the public assistant. Please log in for full access."
        });
      }
    }

    console.log('Public navigation chat request:', sanitizedMessage);

    // Enhanced navigation-focused prompt for public users
    const navigationPrompt = `You are a helpful navigation assistant for the HSSM (Health Systems Support Management) system. You can ONLY help with:

NAVIGATION & SYSTEM USAGE:
- How to navigate the dashboard and menus
- How to access different sections (Classes, Students, Teachers, Reports)
- How to use the main features and interface
- General system functionality and workflow
- Getting started guide

RESTRICTED TOPICS (do not answer):
- Personal account information
- Login/authentication issues
- Private data or reports
- Specific user data
- Administrative functions
- Any sensitive information

If the user asks about restricted topics, politely redirect them to log in or explain that you can only help with navigation.

USER QUESTION: ${sanitizedMessage}

Respond as a friendly navigation guide. Keep responses helpful, clear, and focused on system usage. If the question is not about navigation, suggest they log in for more comprehensive help.`;

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
                text: navigationPrompt
              }]
            }]
          },
          {
            headers: { "Content-Type": "application/json" },
            timeout: 25000 // Shorter timeout for public requests
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

      // Check if the response indicates a restricted topic
      const restrictedIndicators = [
        /log in/i,
        /login/i,
        /sign in/i,
        /authentication/i,
        /account/i,
        /private/i,
        /personal/i
      ];

      const isRestricted = restrictedIndicators.some(pattern => pattern.test(reply));

      res.json({
        success: true,
        reply,
        isNavigationOnly: true,
        restricted: isRestricted,
        timestamp: new Date()
      });
    } else {
      console.error('Unexpected AI response structure:', response.data);

      res.status(500).json({
        success: false,
        message: 'Sorry, I\'m having trouble responding right now. Please try again or log in for full assistance.'
      });
    }
  } catch (error) {
    console.error('Error in public chat route:', error);

    // Provide helpful fallback responses for navigation
    const navigationFallbacks = {
      'dashboard': 'The dashboard is your main overview page. It shows system statistics and quick access to all features.',
      'classes': 'The Classes section helps you manage course enrollments and schedules.',
      'students': 'The Students section allows you to view and manage student information.',
      'teachers': 'The Teachers section provides tools for instructor management.',
      'reports': 'The Reports section contains system analytics and performance data.',
      'help': 'I can help you navigate the system! Ask me about any section or feature.',
      'default': 'I\'m here to help you navigate the system. Try asking about the dashboard, classes, or other features!'
    };

    const message = req.body?.message?.toLowerCase() || '';
    let fallbackReply = navigationFallbacks.default;

    for (const [key, response] of Object.entries(navigationFallbacks)) {
      if (key !== 'default' && message.includes(key)) {
        fallbackReply = response;
        break;
      }
    }

    res.status(500).json({
      success: false,
      reply: fallbackReply,
      isNavigationOnly: true,
      fallback: true
    });
  }
});

module.exports = router;
