const express = require('express');
const { registerUser, loginUser, forgotPassword, DeviceToken, getProfile } = require('../controllers/authController');
const router = express.Router();

router.post('/signup', registerUser);
router.post('/login', loginUser);
router.post('/forgot-password', forgotPassword);
router.post('/device-token', DeviceToken);

// Logout endpoint
router.post('/logout', (req, res) => {
  // If using sessions, destroy session here. For JWT, just instruct client to delete token.
  res.status(200).json({ message: 'Logged out successfully.' });
});

// Update user profile (name, email)
router.put('/profile', require('../middlewares/authMiddleware').protect, require('../controllers/authController').updateProfile);

// Change password
router.put('/change-password', require('../middlewares/authMiddleware').protect, require('../controllers/authController').changePassword);

// Get user profile info (including 2FA status)
router.get('/profile', require('../middlewares/authMiddleware').protect, getProfile);

module.exports = router;