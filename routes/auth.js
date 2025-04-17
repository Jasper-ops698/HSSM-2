const express = require('express');
const router = express.Router();

// Middleware to validate request payload
const validateDeviceTokenPayload = (req, res, next) => {
  const { userId, deviceToken } = req.body;

  if (!userId) {
    return res.status(400).json({ message: 'User ID is required.' });
  }

  if (!deviceToken) {
    return res.status(400).json({ message: 'Device token is required.' });
  }

  next();
};

// Endpoint to register device token
router.post('/device-token', validateDeviceTokenPayload, async (req, res) => {
  try {
    const { userId, deviceToken } = req.body;

    if (!userId || !deviceToken) {
      return res.status(400).json({ message: 'Invalid payload. userId and deviceToken are required.' });
    }

    // Example: Save the device token to the database
    console.log(`Saving device token for userId: ${userId}, deviceToken: ${deviceToken}`);
    const result = { success: true }; // Replace with actual database operation

    if (!result.success) {
      return res.status(500).json({ message: 'Failed to save device token.' });
    }

    res.status(200).json({ message: 'Device token registered successfully.' });
  } catch (error) {
    console.error('Error registering device token:', error);
    res.status(500).json({ message: 'An internal server error occurred.' });
  }
});

// Mock function to save device token to the database
const saveDeviceTokenToDatabase = async (userId, deviceToken) => {
  // Simulate database save operation
  console.log(`Saving device token for userId: ${userId}, deviceToken: ${deviceToken}`);
  return { success: true }; // Simulate success
};

module.exports = router;
