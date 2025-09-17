const jwt = require('jsonwebtoken');
const User = require('../models/User');
require('dotenv').config();

// Middleware to protect routes (ensure the user is authenticated)
exports.protect = async (req, res, next) => {
  let token;

  // Ensure the Authorization header contains a valid Bearer token
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];

    try {
      // Decode and verify the token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Fetch user and bind to request (ensure user exists)
      req.user = await User.findById(decoded.userId).select('-password');
      
      if (!req.user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Optional: Check if the user's role is authorized for a certain action
      // if (req.user.role !== 'admin') {
      //   return res.status(403).json({ message: 'Access denied' });
      // }

      next(); // Proceed to the next middleware or route handler
    } catch (err) {
      console.error('JWT Error:', err); // Log errors for debugging

      // Handle specific JWT errors
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ message: 'Token expired, please login again' });
      }

      if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({ message: 'Invalid token, please login again' });
      }

      // Catch-all error for invalid or failed token verification
      return res.status(401).json({ message: 'Not authorized, token failed' });
    }
  } else {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }
};

// Middleware to check if user is admin
exports.admin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ message: 'Access denied. Admin role required.' });
  }
};

// Middleware to check if user is teacher
exports.teacher = (req, res, next) => {
  if (req.user && (req.user.role === 'teacher' || req.user.role === 'admin')) {
    next();
  } else {
    res.status(403).json({ message: 'Access denied. Teacher role required.' });
  }
};

// Export all middleware functions
module.exports = {
  protect: exports.protect,
  admin: exports.admin,
  teacher: exports.teacher
};