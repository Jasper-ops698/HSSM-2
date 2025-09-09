const express = require('express');
const router = express.Router();
const { generateReport, chatWithAI } = require('../controllers/aiController');

// Route for generating AI reports
router.post('/report', generateReport);

// Route for AI chat
router.post('/chat', chatWithAI);

module.exports = router;
