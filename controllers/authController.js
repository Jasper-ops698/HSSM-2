const User = require('../models/User');
const bcrypt = require('bcryptjs');
const generateToken = require('../utils/generateToken');
const { validationResult } = require('express-validator');
const nodemailer = require('nodemailer'); // For sending emails
const dotenv = require('dotenv');
dotenv.config();

// Define environment variables for email configuration (or use a .env file)
const { EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASSWORD } = process.env;

// Create a reusable transporter object for sending emails
const transporter = nodemailer.createTransport({
  host: EMAIL_HOST,
  port: EMAIL_PORT,
  secure: false, // true for 465, false for other ports
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASSWORD,
  },
});

exports.registerUser = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { name, email, phone, password, role } = req.body;

  try {
    // Check if user already exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create the new user
    const user = await User.create({ name, email, phone, password: hashedPassword, role });

    // Generate token for the user
    const token = generateToken(user._id, email, name, phone, role);

    // Return only the token and user data as separate fields
    return res.status(201).json({
      token, // This will be a string
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

exports.loginUser = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email, password } = req.body;

  try {
    // Find the user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Compare password hashes
    const isPasswordMatch = await bcrypt.compare(password, user.password);
    if (!isPasswordMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate token
    const token = generateToken(user._id, user.email, user.name, user.phone, user.role);

    // Return the token and user data
    return res.status(200).json({
      token, // This will be a string
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

exports.forgotPassword = async (req, res) => {
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
      from: EMAIL_USER,
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

exports.DeviceToken = async (req, res) => {
  const { userId, deviceToken } = req.body;
  
  try {
    // Validate the device token and userId (optional)
    if (!userId || !deviceToken) {
      return res.status(400).json({ message: 'User ID and device token are required' });
    }

    // Find the user and update the device token
    const user = await User.findByIdAndUpdate(userId, { deviceToken }, { new: true });
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Successfully updated the device token
    res.status(200).json({ message: 'Device token updated successfully' });
  } catch (err) {
    console.error('Error saving device token:', err);
    res.status(500).json({ message: 'Error saving device token' });
  }
};