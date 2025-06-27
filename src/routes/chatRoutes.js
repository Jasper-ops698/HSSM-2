const express = require('express');
const axios = require('axios');
const router = express.Router();

router.post('/chat', async (req, res) => {
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ success: false, reply: 'Message is required.' });
  }

  try {
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        contents: [
          {
            parts: [{ text: message }],
          },
        ],
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    const reply = response.data.contents[0].parts[0].text;
    res.status(200).json({ success: true, reply });
  } catch (error) {
    console.error('Error communicating with Gemini API:', error?.response?.data || error.message);
    res.status(500).json({ success: false, reply: 'Failed to get a response from the AI.' });
  }
});

module.exports = router;
