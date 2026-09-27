const { query } = require('../config/db');
const { ok, fail } = require('../utils/serialize');
const { absoluteUrl } = require('./uploadController');

const BACKGROUND_COLORS = [
  '#7c3aed', '#2563eb', '#0891b2', '#059669', '#d97706',
  '#dc2626', '#db2777', '#4f46e5', '#0d9488', '#374151',
];

/**
 * GET /api/statuses
 * Active (non-expired) statuses of the user + people they share a chat with.
 */
async function list(req, res, next) {
  try {
    const userId = Number(req.user.id);
    const { rows } = await query(
      `SELECT s.id, s.user_id, s.status_type, s.content, s.background_color, s.media_url,
              s.caption, s.created_at, s.expires_at,
              u.full_name, u.username, u.profile_image,
              (SELECT COUNT(*) FROM status_views v WHERE v.status_id = s.id)::int AS view_count,
              (SELECT 1 FROM status_views v WHERE v.status_id = s.id AND v.viewer_id = $1 LIMIT 1) AS viewed
         FROM statuses s JOIN users u ON u.id = s.user_id
        WHERE s.expires_at > NOW()
          AND (s.user_id = $1 OR s.user_id IN (
                SELECT DISTINCT them.user_id
                  FROM conversation_members me
                  JOIN conversation_members them
                    ON them.conversation_id = me.conversation_id AND them.user_id <> me.user_id
                 WHERE me.user_id = $1
              ))
        ORDER BY s.created_at DESC
        LIMIT 200`,
      [userId]
    );

    // Group by user for a story-tray UI.
    const byUser = new Map();
    for (const row of rows) {
      const key = Number(row.user_id);
      if (!byUser.has(key)) {
        byUser.set(key, {
          user: {
            id: key,
            full_name: row.full_name,
            username: row.username,
            profile_image: row.profile_image || null,
          },
          items: [],
        });
      }
      byUser.get(key).items.push({
        id: Number(row.id),
        status_type: row.status_type,
        content: row.content,
        background_color: row.background_color,
        media_url: row.media_url ? absoluteUrl(req, row.media_url) : null,
        caption: row.caption,
        created_at: row.created_at,
        expires_at: row.expires_at,
        view_count: Number(row.view_count || 0),
        viewed: Boolean(row.viewed),
        is_mine: key === userId,
      });
    }

    const mine = byUser.get(userId) || null;
    const others = [...byUser.entries()].filter(([id]) => id !== userId).map(([, value]) => value);
    return ok(res, { mine, others });
  } catch (error) {
    return next(error);
  }
}

/**
 * POST /api/statuses
 * Text: { status_type:'text', content, background_color? }
 * Media: { status_type:'image'|'video', media:{media_url,media_public_id}, caption? }
 */
async function create(req, res, next) {
  try {
    const type = req.body.status_type;
    if (!['text', 'image', 'video'].includes(type)) return fail(res, 'Invalid status type.', 422);

    let content = null;
    let backgroundColor = null;
    let mediaUrl = null;
    let mediaPublicId = null;
    let caption = null;

    if (type === 'text') {
      content = typeof req.body.content === 'string' ? req.body.content.trim() : '';
      if (!content || content.length > 700) return fail(res, 'Status text is required (max 700 chars).', 422);
      backgroundColor = BACKGROUND_COLORS.includes(req.body.background_color)
        ? req.body.background_color
        : BACKGROUND_COLORS[0];
    } else {
      const m = req.body.media;
      const valid =
        m && typeof m.media_url === 'string' &&
        (m.media_url.startsWith('https://') || m.media_url.includes('/api/media/')) &&
        typeof m.media_public_id === 'string' && m.media_public_id.length > 0;
      if (!valid) return fail(res, 'Media is required for this status type.', 422);
      mediaUrl = m.media_url;
      mediaPublicId = m.media_public_id;
      caption = typeof req.body.caption === 'string' ? req.body.caption.trim().slice(0, 700) || null : null;
    }

    const { rows } = await query(
      `INSERT INTO statuses (user_id, status_type, content, background_color, media_url, media_public_id, caption, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW() + INTERVAL '24 hours') RETURNING id, expires_at`,
      [req.user.id, type, content, backgroundColor, mediaUrl, mediaPublicId, caption]
    );
    return ok(res, { id: Number(rows[0].id), expires_at: rows[0].expires_at }, 'Status posted', 201);
  } catch (error) {
    return next(error);
  }
}

/**
 * DELETE /api/statuses/:id — author only.
 */
async function remove(req, res, next) {
  try {
    const { rowCount } = await query(
      'DELETE FROM statuses WHERE id = $1 AND user_id = $2',
      [Number(req.params.id), req.user.id]
    );
    if (!rowCount) return fail(res, 'Status not found.', 404);
    return ok(res, null, 'Status deleted');
  } catch (error) {
    return next(error);
  }
}

/**
 * POST /api/statuses/:id/view — record a view (not on own statuses).
 */
async function view(req, res, next) {
  try {
    const statusId = Number(req.params.id);
    const { rows } = await query('SELECT user_id FROM statuses WHERE id = $1 AND expires_at > NOW() LIMIT 1', [statusId]);
    if (!rows.length) return fail(res, 'Status not found.', 404);
    if (Number(rows[0].user_id) !== Number(req.user.id)) {
      await query('INSERT INTO status_views (status_id, viewer_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [statusId, req.user.id]);
    }
    return ok(res, null, 'Viewed');
  } catch (error) {
    return next(error);
  }
}

/**
 * GET /api/statuses/:id/views — viewers list, author only.
 */
async function viewers(req, res, next) {
  try {
    const statusId = Number(req.params.id);
    const { rows } = await query('SELECT user_id FROM statuses WHERE id = $1 LIMIT 1', [statusId]);
    if (!rows.length) return fail(res, 'Status not found.', 404);
    if (Number(rows[0].user_id) !== Number(req.user.id)) return fail(res, 'Only the author can see viewers.', 403);

    const { rows: viewers } = await query(
      `SELECT u.id, u.full_name, u.username, u.profile_image, v.viewed_at
         FROM status_views v JOIN users u ON u.id = v.viewer_id
        WHERE v.status_id = $1 ORDER BY v.viewed_at DESC`,
      [statusId]
    );
    return ok(res, { viewers: viewers.map((v) => ({ id: Number(v.id), full_name: v.full_name, username: v.username, profile_image: v.profile_image || null, viewed_at: v.viewed_at })) });
  } catch (error) {
    return next(error);
  }
}

module.exports = { list, create, remove, view, viewers, BACKGROUND_COLORS };
