const { query } = require('../config/db');
const { ok, fail } = require('../utils/serialize');
const { verifyPassword, hashPassword, signToken } = require('../utils/tokens');

const VISIBILITIES = ['everyone', 'contacts', 'nobody'];

/**
 * PUT /api/users/privacy
 * Body: { last_seen_visibility?, profile_photo_visibility?, read_receipts_enabled? }
 */
async function updatePrivacy(req, res, next) {
  try {
    const updates = {};
    if (req.body.last_seen_visibility !== undefined) {
      if (!VISIBILITIES.includes(req.body.last_seen_visibility)) return fail(res, 'Invalid last seen visibility.', 422);
      updates.last_seen_visibility = req.body.last_seen_visibility;
    }
    if (req.body.profile_photo_visibility !== undefined) {
      if (!VISIBILITIES.includes(req.body.profile_photo_visibility)) return fail(res, 'Invalid profile photo visibility.', 422);
      updates.profile_photo_visibility = req.body.profile_photo_visibility;
    }
    if (req.body.read_receipts_enabled !== undefined) {
      updates.read_receipts_enabled = Boolean(req.body.read_receipts_enabled);
    }
    if (!Object.keys(updates).length) return fail(res, 'Nothing to update.', 422);

    const keys = Object.keys(updates);
    const sets = keys.map((key, i) => `${key} = $${i + 1}`).join(', ');
    await query(`UPDATE users SET ${sets} WHERE id = $${keys.length + 1}`, [...Object.values(updates), req.user.id]);

    const { rows } = await query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    const { privateUser: shapePrivate } = require('../utils/serialize');
    return ok(res, { user: shapePrivate(rows[0]) }, 'Privacy updated');
  } catch (error) {
    return next(error);
  }
}

/**
 * PUT /api/users/password
 * Body: { current_password, new_password }
 */
async function changePassword(req, res, next) {
  try {
    const currentPassword = typeof req.body.current_password === 'string' ? req.body.current_password : '';
    const newPassword = typeof req.body.new_password === 'string' ? req.body.new_password : '';
    if (newPassword.length < 8) return fail(res, 'New password must be at least 8 characters.', 422);
    if (newPassword.length > 72) return fail(res, 'New password is too long.', 422);

    const { rows } = await query('SELECT password_hash FROM users WHERE id = $1 LIMIT 1', [req.user.id]);
    if (!rows.length) return fail(res, 'User not found.', 404);

    const valid = await verifyPassword(currentPassword, rows[0].password_hash);
    if (!valid) return fail(res, 'Current password is incorrect.', 401);

    const hash = await hashPassword(newPassword);
    await query(
      'UPDATE users SET password_hash = $1, password_changed_at = NOW() WHERE id = $2',
      [hash, req.user.id]
    );

    const { rows: fresh } = await query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    const { privateUser: shapePrivate } = require('../utils/serialize');
    const user = shapePrivate(fresh[0]);
    const token = signToken(user);
    return ok(res, { user, token }, 'Password changed');
  } catch (error) {
    return next(error);
  }
}

module.exports = { updatePrivacy, changePassword };
