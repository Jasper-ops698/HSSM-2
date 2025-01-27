const express = require('express');
const { Configuration, OpenAIApi } = require('openai');
const router = express.Router();

// Load API Key securely
require('dotenv').config();
const openai = new OpenAIApi(new Configuration({
    apiKey: process.env.OPENAI_API_KEY // API key from .env file
}));

// Route to handle chatbot messages
router.post('/', async (req, res) => {
    const { userMessage } = req.body;

    try {
        const response = await openai.createChatCompletion({
            model: 'gpt-4',
            messages: [{ role: 'user', content: userMessage }], 
        });
        const botMessage = response.data.choices[0].message.content;
        res.json({ botMessage });
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ error: 'Error communicating with OpenAI API' });
    }
});

module.exports = router;