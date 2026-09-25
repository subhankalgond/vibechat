const { query } = require('../config/db');
const { signToken, hashPassword, verifyPassword } = require('../utils/tokens');
const { publicUser, privateUser, ok, fail } = require('../utils/serialize');
const { validateRegister } = require('../middleware/validate');

/**
 * POST /api/auth/register
 */
async function register(req, res, next) {
  try {
    const { errors, values } = validateRegister(req.body);
    if (Object.keys(errors).length) {
      return fail(res, Object.values(errors)[0], 422, errors);
    }

    const username = values.username.toLowerCase();
    const { rows: dupe } = await query(
      'SELECT username, email FROM users WHERE username = $1 OR email = $2 LIMIT 2',
      [username, values.email]
    );
    if (dupe.length) {
      const emailConflict = dupe.some((row) => row.email === values.email && row.username !== username);
      return fail(res, emailConflict ? 'Email is already registered.' : 'Username already exists.', 409);
    }

    const passwordHash = await hashPassword(values.password);
    const { rows } = await query(
      `INSERT INTO users (full_name, username, email, password_hash)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [values.fullName, username, values.email, passwordHash]
    );

    const user = privateUser(rows[0]);
    const token = signToken(user);
    return ok(res, { token, user }, 'Account created', 201);
  } catch (error) {
    if (error.code === '23505') {
      // Unique violation raced past the pre-check.
      const which = error.detail && error.detail.includes('email') ? 'email' : 'username';
      return fail(res, which === 'email' ? 'Email is already registered.' : 'Username already exists.', 409);
    }
    return next(error);
  }
}

/**
 * POST /api/auth/login  { identifier: email or username, password }
 */
async function login(req, res, next) {
  try {
    const identifier = typeof req.body.identifier === 'string' ? req.body.identifier.trim().toLowerCase() : '';
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    if (!identifier || !password) {
      return fail(res, 'Enter your email or username and password.', 422);
    }

    const { rows } = await query(
      'SELECT * FROM users WHERE username = $1 OR email = $1 LIMIT 1',
      [identifier]
    );
    const row = rows[0];
    if (!row) return fail(res, 'Invalid credentials. Please try again.', 401);

    const match = await verifyPassword(password, row.password_hash);
    if (!match) return fail(res, 'Invalid credentials. Please try again.', 401);

    const user = privateUser(row);
    const token = signToken(user);
    return ok(res, { token, user }, 'Signed in');
  } catch (error) {
    return next(error);
  }
}

/**
 * GET /api/auth/me
 */
async function me(req, res, next) {
  try {
    const { rows } = await query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    if (!rows.length) return fail(res, 'Account not found.', 404);
    return ok(res, { user: privateUser(rows[0]) });
  } catch (error) {
    return next(error);
  }
}

/**
 * POST /api/auth/logout  (stateless JWT; client discards token)
 */
async function logout(req, res) {
  return ok(res, null, 'Signed out');
}

module.exports = { register, login, me, logout };
