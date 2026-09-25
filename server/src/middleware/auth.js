const jwt = require('jsonwebtoken');
const env = require('../config/env');

/**
 * Requires a valid Bearer token. Attaches { id, username } to req.user.
 */
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }
  try {
    const payload = jwt.verify(token, env.jwtSecret);
    req.user = { id: payload.sub, username: payload.username };
    return next();
  } catch {
    return res.status(401).json({ success: false, message: 'Session expired. Please sign in again.' });
  }
}

module.exports = { requireAuth };
