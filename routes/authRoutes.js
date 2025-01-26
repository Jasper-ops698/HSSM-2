const express = require('express');
const { registerUser, loginUser, forgotPassword, DeviceToken } = require('../controllers/authController');
const router = express.Router();

router.post('/signup', registerUser);
router.post('/login', loginUser);
router.post('/forgot-password', forgotPassword);
router.post('/device-token', DeviceToken);

module.exports = router;