const express = require('express');
const axios = require('axios');
const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ success: false, reply: 'Message is required.' });
    }

    console.log('Received chat message:', message);

    const contextAwarePrompt = `You are a helpful assistant for a Health Systems Support Management (HSSM) system. 
    The system manages hospital services across different levels (1-6), assets, incidents, and maintenance tasks. 
    
    User's question: ${message}`;

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
        }
      }
    );

    console.log('Gemini API response structure:', JSON.stringify(response.data, null, 2));

    if (response.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
      const reply = response.data.candidates[0].content.parts[0].text;
      res.json({ success: true, reply });
    } else {
      console.error('Unexpected API response structure:', response.data);
      res.status(500).json({ 
        success: false, 
        reply: 'Got an invalid response from the AI service.' 
      });
    }
  } catch (error) {
    console.error('Error in chat route:', error.response?.data || error.message);
    res.status(500).json({ 
      success: false, 
      reply: 'Failed to get a response from the AI. Please try again.' 
    });
  }
});

module.exports = router;
