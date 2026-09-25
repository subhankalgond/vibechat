const { query } = require('../config/db');
const { publicUser, ok, fail } = require('../utils/serialize');
const { validateProfileUpdate } = require('../middleware/validate');
const { signToken } = require('../utils/tokens');

/**
 * GET /api/users/search?q=
 */
async function search(req, res, next) {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';
    if (!q) return ok(res, { users: [] });
    if (q.length > 30) return fail(res, 'Search term is too long.', 422);

    const like = `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
    const { rows } = await query(
      `SELECT id, full_name, username, profile_image, bio, is_online, last_seen
         FROM users
        WHERE username LIKE $1 AND id <> $2
        ORDER BY CASE WHEN username = $3 THEN 0 ELSE 1 END, username
        LIMIT 20`,
      [like, req.user.id, q]
    );
    return ok(res, { users: rows.map(publicUser) });
  } catch (error) {
    return next(error);
  }
}

/**
 * GET /api/users/:username
 */
async function getByUsername(req, res, next) {
  try {
    const username = String(req.params.username || '').trim().toLowerCase();
    if (!username) return fail(res, 'User not found.', 404);

    const { rows } = await query(
      `SELECT id, full_name, username, profile_image, bio, is_online, last_seen
         FROM users WHERE username = $1 LIMIT 1`,
      [username]
    );
    if (!rows.length) return fail(res, 'User not found.', 404);

    const user = publicUser(rows[0]);
    let conversationId = null;
    if (Number(rows[0].id) !== Number(req.user.id)) {
      const { rows: existing } = await query(
        `SELECT cm1.conversation_id AS id
           FROM conversation_members cm1
           JOIN conversation_members cm2
             ON cm1.conversation_id = cm2.conversation_id
          WHERE cm1.user_id = $1 AND cm2.user_id = $2
          LIMIT 1`,
        [req.user.id, rows[0].id]
      );
      conversationId = existing.length ? existing[0].id : null;
    }
    return ok(res, { user, conversationId });
  } catch (error) {
    return next(error);
  }
}

/**
 * PUT /api/users/profile
 */
async function updateProfile(req, res, next) {
  try {
    const { errors, updates } = validateProfileUpdate(req.body);
    if (Object.keys(errors).length) {
      return fail(res, Object.values(errors)[0], 422, errors);
    }
    if (!Object.keys(updates).length) {
      return fail(res, 'Nothing to update.', 422);
    }

    if (updates.username) {
      const { rows: dupe } = await query(
        'SELECT id FROM users WHERE username = $1 AND id <> $2 LIMIT 1',
        [updates.username.toLowerCase(), req.user.id]
      );
      if (dupe.length) return fail(res, 'Username already exists.', 409);
      updates.username = updates.username.toLowerCase();
    }

    const keys = Object.keys(updates);
    const sets = keys.map((key, i) => `${key} = $${i + 1}`).join(', ');
    const params = [...Object.values(updates), req.user.id];
    await query(`UPDATE users SET ${sets} WHERE id = $${keys.length + 1}`, params);

    const { rows } = await query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    const { privateUser: shapePrivate } = require('../utils/serialize');
    const user = shapePrivate(rows[0]);
    const token = signToken(user);
    return ok(res, { user, token }, 'Profile updated');
  } catch (error) {
    if (error.code === '23505') {
      return fail(res, 'Username already exists.', 409);
    }
    return next(error);
  }
}

module.exports = { search, getByUsername, updateProfile };
