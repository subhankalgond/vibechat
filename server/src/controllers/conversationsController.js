const { query } = require('../config/db');
const { publicUser, ok, fail } = require('../utils/serialize');
const { findOrCreateConversation, getMembership } = require('../services/directConversations');

/**
 * GET /api/conversations
 * Returns conversations with the other member, last message, unread count.
 */
async function list(req, res, next) {
  try {
    const userId = Number(req.user.id);
    const { rows } = await query(
      `SELECT c.id,
              c.updated_at,
              other.id AS other_id,
              other.full_name AS other_full_name,
              other.username AS other_username,
              other.profile_image AS other_profile_image,
              other.is_online AS other_is_online,
              other.last_seen AS other_last_seen,
              (SELECT m.message_type FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC, m.id DESC LIMIT 1) AS last_type,
              (SELECT m.message_text FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC, m.id DESC LIMIT 1) AS last_text,
              (SELECT m.sender_id FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC, m.id DESC LIMIT 1) AS last_sender_id,
              (SELECT m.created_at FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC, m.id DESC LIMIT 1) AS last_created_at,
              (SELECT COUNT(*) FROM messages m
                WHERE m.conversation_id = c.id AND m.sender_id <> $1 AND m.seen_at IS NULL
                  AND NOT EXISTS (SELECT 1 FROM message_deletions d WHERE d.message_id = m.id AND d.user_id = $1)
              )::int AS unread_count
         FROM conversation_members me
         JOIN conversations c ON c.id = me.conversation_id
         JOIN conversation_members them
           ON them.conversation_id = c.id AND them.user_id <> me.user_id
         JOIN users other ON other.id = them.user_id
        WHERE me.user_id = $1
        ORDER BY c.updated_at DESC`,
      [userId]
    );

    return ok(res, {
      conversations: rows.map((row) => ({
        id: Number(row.id),
        updated_at: row.updated_at,
        other_user: {
          id: Number(row.other_id),
          full_name: row.other_full_name,
          username: row.other_username,
          profile_image: row.other_profile_image || null,
          is_online: Boolean(row.other_is_online),
          last_seen: row.other_last_seen || null,
        },
        last_message: row.last_type
          ? {
              type: row.last_type,
              text: row.last_text || '',
              sender_id: Number(row.last_sender_id),
              created_at: row.last_created_at,
            }
          : null,
        unread_count: Number(row.unread_count || 0),
      })),
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * POST /api/conversations  { username }
 */
async function create(req, res, next) {
  try {
    const username = typeof req.body.username === 'string' ? req.body.username.trim().toLowerCase() : '';
    if (!username) return fail(res, 'Username is required.', 422);

    const { rows } = await query('SELECT id FROM users WHERE username = $1 LIMIT 1', [username]);
    if (!rows.length) return fail(res, 'User not found.', 404);
    if (Number(rows[0].id) === Number(req.user.id)) {
      return fail(res, 'You cannot start a conversation with yourself.', 422);
    }

    const { id, created } = await findOrCreateConversation(req.user.id, Number(rows[0].id));
    return ok(res, { id }, created ? 'Conversation created' : 'Conversation exists', created ? 201 : 200);
  } catch (error) {
    return next(error);
  }
}

/**
 * GET /api/conversations/:id
 */
async function getOne(req, res, next) {
  try {
    const conversationId = Number(req.params.id);
    const membership = await getMembership(conversationId, req.user.id);
    if (!membership) return fail(res, 'Conversation not found.', 404);

    const { rows } = await query(
      `SELECT u.id, u.full_name, u.username, u.profile_image, u.bio, u.is_online, u.last_seen
         FROM conversation_members cm
         JOIN users u ON u.id = cm.user_id
        WHERE cm.conversation_id = $1 AND u.id <> $2
        LIMIT 1`,
      [conversationId, req.user.id]
    );
    const other = rows[0] ? publicUser(rows[0]) : null;
    return ok(res, { id: conversationId, other_user: other });
  } catch (error) {
    return next(error);
  }
}

/**
 * DELETE /api/conversations/:id
 * Hides the conversation and its messages for the requesting user only.
 */
async function remove(req, res, next) {
  try {
    const conversationId = Number(req.params.id);
    const membership = await getMembership(conversationId, req.user.id);
    if (!membership) return fail(res, 'Conversation not found.', 404);

    await query(
      `INSERT INTO message_deletions (message_id, user_id)
       SELECT id, $1 FROM messages WHERE conversation_id = $2
       ON CONFLICT DO NOTHING`,
      [req.user.id, conversationId]
    );
    await query(
      'DELETE FROM conversation_members WHERE conversation_id = $1 AND user_id = $2',
      [conversationId, req.user.id]
    );
    return ok(res, null, 'Conversation removed');
  } catch (error) {
    return next(error);
  }
}

module.exports = { list, create, getOne, remove };
