const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const generateToken = (userId, email, name, phone, role = 'user', department = '') => {
  const secretKey = process.env.JWT_SECRET;  // Secret key for signing the token
  const expiresIn = '1h';  // Token expiration time

  // Ensure the secret key exists
  if (!secretKey) {
    throw new Error('JWT_SECRET is not defined. Ensure you set the environment variable.');
  }

  // Define the payload for the token
  const payload = { 
    userId,
    email,
    name,
    phone, 
    role,
    department
  };

  try {
    // Generate the JWT token as a string
    const token = jwt.sign(payload, secretKey, { expiresIn });
    return token;  // Directly return the token as a string
  } catch (error) {

    throw new Error('Error generating the JWT token');
  }
};

module.exports = generateToken;
