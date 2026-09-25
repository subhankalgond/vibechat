const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const env = require('../config/env');

function signToken(user) {
  return jwt.sign({ sub: String(user.id), username: user.username }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  });
}

function verifyToken(token) {
  return jwt.verify(token, env.jwtSecret);
}

function hashPassword(plain) {
  return bcrypt.hash(plain, 10);
}

function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

module.exports = { signToken, verifyToken, hashPassword, verifyPassword };
