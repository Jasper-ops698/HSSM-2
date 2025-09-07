const express = require('express');
const axios = require('axios');
const rateLimit = require('express-rate-limit');
const router = express.Router();

// Rate limiter for chat: 10 requests per minute per IP
const chatLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // Limit each IP to 10 requests per windowMs
  message: { success: false, reply: 'Too many chat requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
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

router.post('/', chatLimiter, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ success: false, reply: 'Message is required.' });
    }

    console.log('Received chat message:', message);

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
    
    User's question: ${message}`;

    console.log('Making request to Gemini API...');

    const response = await axios.post(
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

    console.log('Gemini API response received');
    console.log('Gemini API response structure:', JSON.stringify(response.data, null, 2));

    if (response.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
      const reply = response.data.candidates[0].content.parts[0].text;
      console.log('Successfully extracted reply from Gemini response');
      res.json({ success: true, reply });
    } else {
      console.error('Unexpected API response structure:', response.data);
      res.status(500).json({ 
        success: false, 
        reply: 'Got an invalid response from the AI service.' 
      });
    }
  } catch (error) {
    console.error('Error in chat route:', error.message);
    
    if (error.response) {
      console.error('Gemini API error response:', error.response.status, error.response.data);
      
      if (error.response.status === 400) {
        return res.status(500).json({ 
          success: false, 
          reply: 'Invalid request to AI service. Please try again.' 
        });
      } else if (error.response.status === 403) {
        return res.status(500).json({ 
          success: false, 
          reply: 'AI service access denied. Please try again later.' 
        });
      } else if (error.response.status === 429) {
        return res.status(500).json({ 
          success: false, 
          reply: 'AI service rate limit exceeded. Please try again later.' 
        });
      }
    } else if (error.code === 'ECONNABORTED') {
      console.error('Gemini API request timeout');
      return res.status(500).json({ 
        success: false, 
        reply: 'AI service request timed out. Please try again.' 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      reply: 'Failed to get a response from the AI. Please try again.' 
    });
  }
});

module.exports = router;
