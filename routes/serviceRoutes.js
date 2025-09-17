const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');

// Mock service data - replace with actual service model/controller
const services = [
  { id: 1, name: 'Service 1', description: 'Description 1' },
  { id: 2, name: 'Service 2', description: 'Description 2' },
];

// @route   GET /api/services
// @desc    Get all services
// @access  Public
router.get('/', (req, res) => {
  res.json(services);
});

module.exports = router;