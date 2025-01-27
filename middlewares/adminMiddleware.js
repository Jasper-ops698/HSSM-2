const jwt = require('jsonwebtoken');
const User = require('../models/User');

const adminMiddleware = async (req, res, next) => {
  try {
    // Extract token from headers
    const token = req.header('x-auth-token');
    if (!token) {
      return res.status(401).json({ success: false, msg: 'No token, authorization denied.' });
    }

    // Verify token and extract user payload
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded.user;

    // Check if user exists and has admin privileges
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, msg: 'User not found.' });
    }
    if (user.role !== 'admin') {
      return res.status(403).json({ success: false, msg: 'Admin authorization required.' });
    }

    next(); // Proceed to the next middleware
  } catch (err) {
    console.error('Authorization error:', err.message);
    res.status(401).json({ success: false, msg: 'Invalid token or authorization error.' });
  }
};

// Authentication Middleware (Protect)
exports.protect = async (req, res, next) => {
  try {
    const token = req.header('x-auth-token');
    if (!token) {
      return res.status(401).json({ success: false, msg: 'No token, authorization denied.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded.user;
    next();
  } catch (err) {
    console.error('Authorization error:', err.message);
    res.status(401).json({ success: false, msg: 'Invalid token or authorization error.' });
  }
};

// Admin Authorization Middleware (Admin Only)
exports.adminOnly = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ success: false, msg: 'Admin authorization required.' });
    }
    next();
  } catch (err) {
    console.error('Admin authorization error:', err.message);
    res.status(500).json({ success: false, msg: 'Internal server error.' });
  }
};

module.exports = adminMiddleware;
