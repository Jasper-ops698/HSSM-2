const User = require('../models/User');
const bcrypt = require('bcryptjs');
const generateToken = require('../utils/generateToken');
const { validationResult } = require('express-validator');
const nodemailer = require('nodemailer');
const dotenv = require('dotenv');
const speakeasy = require('speakeasy');
dotenv.config();

// Create a reusable transporter object for sending emails
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

// Define the registerUser function
const registerUser = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { name, email, phone, password, role } = req.body;

  try {
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({ name, email, phone, password: hashedPassword, role });

    const token = generateToken(user._id, email, name, phone, role);

    return res.status(201).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
    });
  } catch (err) {
    console.error('Error registering user:', err);
    return res.status(500).json({ message: 'Error registering user' });
  }
};

// Define the loginUser function
const loginUser = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email, password, twoFactorToken } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    if (user.isDisabled) {
      return res.status(403).json({ message: 'Your account has been disabled. Please contact support.' });
    }

    const isPasswordMatch = await bcrypt.compare(password, user.password);
    if (!isPasswordMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // 2FA logic
    if (user.twoFactorEnabled) {
      if (!twoFactorToken) {
        // 2FA required but not provided
        return res.status(206).json({
          twoFactorRequired: true,
          message: 'Two-factor authentication code required.',
          userId: user._id,
        });
      }
      const verified = speakeasy.totp.verify({
        secret: user.twoFactorSecret,
        encoding: 'base32',
        token: twoFactorToken,
        window: 1
      });
      if (!verified) {
        return res.status(401).json({ message: 'Invalid two-factor authentication code.' });
      }
    }

    const token = generateToken(user._id, user.email, user.name, user.phone, user.role);

    return res.status(200).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
    });
  } catch (err) {
    console.error('Error logging in:', err);
    return res.status(500).json({ message: 'Error logging in' });
  }
};

const forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const resetToken = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    const hashedToken = await bcrypt.hash(resetToken, 10);

    await user.updateOne({
      resetToken: hashedToken,
      resetTokenExpires: Date.now() + 3600000, // Expires in 1 hour
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: 'Password Reset Request',
      text: `You are receiving this email because you (or someone else) have requested a password reset for your account.
        Please click on the following link to reset your password: ${process.env.FRONTEND_URL}/reset-password/${resetToken}.
        If you did not request a password reset, please ignore this email.
        This link will expire in 1 hour.`,
    });

    res.status(200).json({ message: 'Password reset email sent' });
  } catch (err) {
    console.error('Error sending password reset email:', err);
    res.status(500).json({ message: 'Error sending password reset email' });
  }
};

const DeviceToken = async (req, res) => {
  const { userId, deviceToken } = req.body;

  // Validate input
  if (!userId) {
    return res.status(400).json({ message: 'User ID is required.' });
  }

  if (!deviceToken) {
    return res.status(400).json({ message: 'Device token is required.' });
  }

  try {
    // Example: Save the device token to the database
    // Replace this with your actual database logic
    console.log(`Saving device token for userId: ${userId}, deviceToken: ${deviceToken}`);
    // Simulate database save operation
    const result = { success: true }; // Replace with actual database operation

    if (!result.success) {
      return res.status(500).json({ message: 'Failed to save device token.' });
    }

    res.status(200).json({ message: 'Device token registered successfully.' });
  } catch (error) {
    console.error('Error registering device token:', error);
    res.status(500).json({ message: 'An internal server error occurred.' });
  }
};

// Update user profile (name, email)
const updateProfile = async (req, res) => {
  try {
    const { name, email } = req.body;
    if (!name || !email) {
      return res.status(400).json({ message: 'Name and email are required.' });
    }
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { name, email },
      { new: true }
    );
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }
    res.json({ user });
  } catch (err) {
    res.status(500).json({ message: 'Error updating profile.' });
  }
};

// Change password
const changePassword = async (req, res) => {
  try {
    const { current, newPassword } = req.body;
    if (!current || !newPassword) {
      return res.status(400).json({ message: 'Current and new password are required.' });
    }
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }
    const isMatch = await bcrypt.compare(current, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect.' });
    }
    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
    res.json({ message: 'Password updated successfully.' });
  } catch (err) {
    res.status(500).json({ message: 'Error changing password.' });
  }
};

// Get user profile
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id || req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching profile.' });
  }
};

module.exports = {
  registerUser,
  loginUser,
  forgotPassword,
  DeviceToken,
  updateProfile,
  changePassword,
  getProfile,
};