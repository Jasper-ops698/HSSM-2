const User = require('../models/User');
const Notification = require('../models/Notification');
const PasswordResetToken = require('../models/PasswordResetToken');
const bcrypt = require('bcryptjs');
const generateToken = require('../utils/generateToken');
const { validationResult } = require('express-validator');
const nodemailer = require('nodemailer');
const dotenv = require('dotenv');
const speakeasy = require('speakeasy');
const crypto = require('crypto');
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

// Verify email configuration on startup
transporter.verify((error, success) => {
  if (error) {
    console.error('Email transporter configuration error:', error);
  } else {
    console.log('Email transporter is ready to send messages');
  }
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

    // Generate verification token
    const verificationToken = require('crypto').randomBytes(32).toString('hex');
    const verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const user = await User.create({ 
      name, 
      email, 
      phone, 
      password: hashedPassword, 
      role,
      verificationToken,
      verificationTokenExpires
    });

    if (role === 'staff') {
      const admins = await User.find({ role: 'admin' });
      const notifications = admins.map(admin => ({
        recipient: admin._id,
        type: 'staff_registration',
        title: 'New Staff Registration',
        message: `A new staff member, ${name}, has registered and requires role assignment.`,
        data: { newUserId: user._id }
      }));
      if (notifications.length > 0) {
        await Notification.insertMany(notifications);
      }
    }

    // Send verification email
    try {
      const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Verify Your Email - MultiShop',
        html: `
          <h2>Welcome to MultiShop!</h2>
          <p>Please verify your email address by clicking the link below:</p>
          <a href="${verificationUrl}" style="background-color: #1976d2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Verify Email</a>
          <p>This link will expire in 24 hours.</p>
          <p>If you didn't create an account, please ignore this email.</p>
        `,
      };

      console.log('Sending verification email to:', email);
      const emailResult = await transporter.sendMail(mailOptions);
      console.log('Verification email sent successfully:', emailResult.messageId);

    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
      // Don't fail registration if email fails, but log it
      // You might want to implement a retry mechanism or queue system here
    }

    return res.status(201).json({
      message: 'Registration successful! Please check your email to verify your account.',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        emailVerified: user.emailVerified,
      },
    });
  } catch (err) {

    return res.status(500).json({ message: 'Error registering user' });
  }
};

// Define the verifyEmail function
const verifyEmail = async (req, res) => {
  const { token } = req.query;

  try {
    const user = await User.findOne({
      verificationToken: token,
      verificationTokenExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired verification token' });
    }

    user.emailVerified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpires = undefined;
    await user.save();

    // Generate auth token for auto-login after verification
    const authToken = generateToken(user._id, user.email, user.name, user.phone, user.role, user.department);

    return res.status(200).json({
      message: 'Email verified successfully!',
      token: authToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        department: user.department,
        emailVerified: user.emailVerified,
      },
    });
  } catch (err) {
    return res.status(500).json({ message: 'Error verifying email' });
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

    // Check if email is verified (only for new users who have verification tokens)
    // Existing users without verification tokens are automatically considered verified
    if (user.verificationToken && !user.emailVerified) {
      return res.status(403).json({ message: 'Please verify your email before logging in.' });
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

    const token = generateToken(user._id, user.email, user.name, user.phone, user.role, user.department);

    return res.status(200).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        department: user.department,
      },
    });
  } catch (err) {

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

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = await bcrypt.hash(resetToken, 10);

    // Create password reset token document
    await PasswordResetToken.create({
      user: user._id,
      token: hashedToken,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // Expires in 1 hour
    });

    // Send reset email
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: 'Password Reset Request - MultiShop',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1976d2;">Password Reset Request</h2>
          <p>You are receiving this email because you (or someone else) have requested a password reset for your account.</p>
          <p>Please click the button below to reset your password:</p>
          <a href="${resetUrl}" style="background-color: #1976d2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 16px 0;">Reset Password</a>
          <p><strong>This link will expire in 1 hour.</strong></p>
          <p>If you did not request a password reset, please ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #666; font-size: 12px;">If the button doesn't work, copy and paste this link into your browser:<br>${resetUrl}</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({
      message: 'Password reset email sent successfully. Please check your email.'
    });
  } catch (err) {
    console.error('Error in forgot password:', err);
    res.status(500).json({ message: 'Error sending password reset email' });
  }
};

// Reset password using token
const resetPassword = async (req, res) => {
  const { token, newPassword } = req.body;

  try {
    // Find the reset token document
    const resetTokenDoc = await PasswordResetToken.findOne({
      expiresAt: { $gt: new Date() },
      used: false
    });

    if (!resetTokenDoc) {
      return res.status(400).json({ message: 'Invalid or expired reset token' });
    }

    // Verify the token
    const isValidToken = await bcrypt.compare(token, resetTokenDoc.token);
    if (!isValidToken) {
      return res.status(400).json({ message: 'Invalid reset token' });
    }

    // Find the user
    const user = await User.findById(resetTokenDoc.user);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update user password
    user.password = hashedPassword;
    await user.save();

    // Mark token as used
    resetTokenDoc.used = true;
    await resetTokenDoc.save();

    // Send confirmation email
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: 'Password Reset Successful - MultiShop',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1976d2;">Password Reset Successful</h2>
          <p>Your password has been successfully reset.</p>
          <p>If you did not make this change, please contact support immediately.</p>
          <p>You can now log in with your new password.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #666; font-size: 12px;">This is an automated message. Please do not reply.</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({
      message: 'Password reset successful. You can now log in with your new password.'
    });
  } catch (err) {
    console.error('Error in reset password:', err);
    res.status(500).json({ message: 'Error resetting password' });
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

    // Simulate database save operation
    const result = { success: true }; // Replace with actual database operation

    if (!result.success) {
      return res.status(500).json({ message: 'Failed to save device token.' });
    }

    res.status(200).json({ message: 'Device token registered successfully.' });
  } catch (error) {

    res.status(500).json({ message: 'An internal server error occurred.' });
  }
};

// Update user profile (name, email, phone, department)
const updateProfile = async (req, res) => {
  try {
    const { name, email, phone, department } = req.body;

    if (!name || !email) {
      return res.status(400).json({ message: 'Name and email are required.' });
    }

    // Check if email is already taken by another user
    const existingUser = await User.findOne({ email, _id: { $ne: req.user._id } });
    if (existingUser) {
      return res.status(400).json({ message: 'Email is already in use by another user.' });
    }

    // Check if phone is already taken by another user
    if (phone) {
      const existingPhoneUser = await User.findOne({ phone, _id: { $ne: req.user._id } });
      if (existingPhoneUser) {
        return res.status(400).json({ message: 'Phone number is already in use by another user.' });
      }
    }

    const updateData = { name, email };
    if (phone) updateData.phone = phone;
    if (department) updateData.department = department;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updateData,
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    res.json({ user });
  } catch (err) {
    console.error('Error updating profile:', err);
    res.status(500).json({ message: 'Error updating profile.' });
  }
};

// Change password
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current and new password are required.' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ message: 'New password must be at least 8 characters long.' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect.' });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.json({ message: 'Password changed successfully.' });
  } catch (err) {
    console.error('Error changing password:', err);
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

// Toggle 2FA
const toggle2FA = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    if (user.twoFactorEnabled) {
      // Disable 2FA
      user.twoFactorEnabled = false;
      user.twoFactorSecret = '';
    } else {
      // Enable 2FA - generate new secret
      const secret = speakeasy.generateSecret({
        name: `MultiShop (${user.email})`,
        issuer: 'MultiShop'
      });
      user.twoFactorSecret = secret.base32;
      user.twoFactorEnabled = true;
    }

    await user.save();

    res.json({
      user,
      message: `Two-factor authentication ${user.twoFactorEnabled ? 'enabled' : 'disabled'} successfully.`,
      ...(user.twoFactorEnabled && {
        qrCodeUrl: `otpauth://totp/MultiShop%20(${encodeURIComponent(user.email)})?secret=${user.twoFactorSecret}&issuer=MultiShop`
      })
    });
  } catch (err) {
    console.error('Error toggling 2FA:', err);
    res.status(500).json({ message: 'Error toggling two-factor authentication.' });
  }
};

// Resend email verification
const resendVerification = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    if (user.emailVerified) {
      return res.status(400).json({ message: 'Email is already verified.' });
    }

    // Generate new verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    user.verificationToken = verificationToken;
    user.verificationTokenExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
    await user.save();

    // Send verification email
    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: 'Email Verification - MultiShop',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Welcome to MultiShop!</h2>
          <p>Please verify your email address by clicking the link below:</p>
          <a href="${verificationUrl}" style="background-color: #0052cc; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 10px 0;">Verify Email</a>
          <p>If the button doesn't work, you can also copy and paste this link into your browser:</p>
          <p>${verificationUrl}</p>
          <p>This link will expire in 24 hours.</p>
          <p>If you didn't create an account, please ignore this email.</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);

    res.json({ message: 'Verification email sent successfully.' });
  } catch (err) {
    console.error('Error resending verification:', err);
    res.status(500).json({ message: 'Error sending verification email.' });
  }
};

module.exports = {
  registerUser,
  loginUser,
  verifyEmail,
  forgotPassword,
  resetPassword,
  DeviceToken,
  updateProfile,
  changePassword,
  getProfile,
  toggle2FA,
  resendVerification,
};