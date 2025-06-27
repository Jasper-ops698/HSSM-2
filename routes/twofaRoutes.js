const express = require('express');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const User = require('../models/User');
const router = express.Router();
const requireAuth = require('../middlewares/authMiddleware');

// Step 1: Generate 2FA secret and QR code for user
router.post('/generate', requireAuth, async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
  if (user.twoFactorEnabled) return res.status(400).json({ success: false, message: '2FA already enabled.' });

  const secret = speakeasy.generateSecret({ name: `MultiShop (${user.email})` });
  user.twoFactorSecret = secret.base32;
  await user.save();
  const otpauth_url = secret.otpauth_url;
  const qr = await qrcode.toDataURL(otpauth_url);
  res.json({ success: true, secret: secret.base32, otpauth_url, qr });
});

// Step 2: Verify 2FA code and enable 2FA
router.post('/verify', requireAuth, async (req, res) => {
  const { token } = req.body;
  const user = await User.findById(req.user.id);
  if (!user || !user.twoFactorSecret) return res.status(400).json({ success: false, message: '2FA not initialized.' });
  const verified = speakeasy.totp.verify({
    secret: user.twoFactorSecret,
    encoding: 'base32',
    token,
    window: 1
  });
  if (!verified) return res.status(400).json({ success: false, message: 'Invalid 2FA code.' });
  user.twoFactorEnabled = true;
  await user.save();
  res.json({ success: true, message: '2FA enabled.' });
});

// Step 3: Validate 2FA code during login
router.post('/validate', async (req, res) => {
  const { userId, token } = req.body;
  const user = await User.findById(userId);
  if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) return res.status(400).json({ success: false, message: '2FA not enabled.' });
  const verified = speakeasy.totp.verify({
    secret: user.twoFactorSecret,
    encoding: 'base32',
    token,
    window: 1
  });
  if (!verified) return res.status(400).json({ success: false, message: 'Invalid 2FA code.' });
  res.json({ success: true, message: '2FA validated.' });
});

// Step 4: Disable 2FA for user
router.post('/disable', requireAuth, async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
  if (!user.twoFactorEnabled) return res.status(400).json({ success: false, message: '2FA is not enabled.' });
  user.twoFactorEnabled = false;
  user.twoFactorSecret = undefined;
  await user.save();
  res.json({ success: true, message: '2FA disabled.' });
});

module.exports = router;
