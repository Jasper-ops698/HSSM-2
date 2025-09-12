const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const generateToken = require('../utils/generateToken');

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// POST /api/auth/google
// Receives { idToken } from frontend, verifies, and logs in or creates user
const googleAuth = async (req, res) => {
  const { idToken } = req.body;
  if (!idToken) return res.status(400).json({ message: 'No ID token provided.' });
  try {
    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    // Find or create user
    let user = await User.findOne({ email: payload.email });
    if (!user) {
      user = await User.create({
        name: payload.name,
        email: payload.email,
        phone: '', // Google doesn't provide phone, you may want to prompt later
        password: '', // Not needed for Google users
        role: 'student', // Default or adjust as needed
        avatar: payload.picture,
        googleId: payload.sub,
        emailVerified: true, // Google accounts are pre-verified
      });
    }
    // Issue your own JWT
    const token = generateToken(user._id, user.email, user.name, user.phone, user.role, user.department);
    res.json({ token, user: user.toJSON() });
  } catch (err) {

    res.status(401).json({ message: 'Invalid Google token' });
  }
};

module.exports = { googleAuth };
