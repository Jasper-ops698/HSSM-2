const express = require('express');
const router = express.Router();
const VENUES = require('../config/venues');

// @route   GET api/venues
// @desc    Get list of all available venues
// @access  Private
router.get('/', (req, res) => {
  res.json(VENUES);
});

module.exports = router;
