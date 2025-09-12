const jwt = require('jsonwebtoken');

/**
 * Middleware to verify user roles and authenticate JWT token.
 * @param {Array} allowedRoles - Roles allowed to access the route.
 */
const verifyRole = (allowedRoles) => {
  return (req, res, next) => {
    try {
      // Extract the token from the Authorization header
      const authHeader = req.headers.authorization;
      const token = authHeader && authHeader.split(' ')[1];

      // If no token is provided, return Unauthorized error
      if (!token) {
        return res.status(401).json({ message: 'Unauthorized: No token provided' });
      }

      // Decode and verify the JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Attach user data from the token to the request object only if not already set
      if (!req.user) {
        req.user = decoded;
      }

      // Check if the user role is authorized
      if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({ message: 'Forbidden: Insufficient role' });
      }

      // If everything checks out, move to the next middleware
      next();
    } catch (error) {
      // Handle different JWT-related errors
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ message: 'Unauthorized: Token expired' });
      } else if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({ message: 'Unauthorized: Invalid token' });
      } else {
        console.error('Token verification error:', error);
        return res.status(500).json({ message: 'Internal Server Error' });
      }
    }
  };
};

module.exports = verifyRole;
