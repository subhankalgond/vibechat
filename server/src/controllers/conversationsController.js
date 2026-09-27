const { query } = require('../config/db');
const { publicUser, ok, fail } = require('../utils/serialize');
const { findOrCreateConversation } = require('../services/directConversations');
const { getMembership, createGroup } = require('../services/conversationService');

/**
 * GET /api/conversations
 * Returns conversations (direct + groups) with counterpart info,
 * last message, unread count.
 */
async function list(req, res, next) {
  try {
    const userId = Number(req.user.id);
    const { rows } = await query(
      `SELECT c.id, c.type, c.name, c.avatar_url, c.updated_at,
              (SELECT m.message_type FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC, m.id DESC LIMIT 1) AS last_type,
              (SELECT m.message_text FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC, m.id DESC LIMIT 1) AS last_text,
              (SELECT m.sender_id FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC, m.id DESC LIMIT 1) AS last_sender_id,
              (SELECT m.created_at FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC, m.id DESC LIMIT 1) AS last_created_at,
              (SELECT COUNT(*) FROM messages m
                WHERE m.conversation_id = c.id AND m.sender_id <> $1 AND m.seen_at IS NULL
                  AND NOT EXISTS (SELECT 1 FROM message_deletions d WHERE d.message_id = m.id AND d.user_id = $1)
              )::int AS unread_count,
              (SELECT COUNT(*) FROM conversation_members cm2 WHERE cm2.conversation_id = c.id)::int AS member_count,
              other.id AS other_id,
              other.full_name AS other_full_name,
              other.username AS other_username,
              other.profile_image AS other_profile_image,
              other.is_online AS other_is_online,
              other.last_seen AS other_last_seen
         FROM conversation_members me
         JOIN conversations c ON c.id = me.conversation_id
         LEFT JOIN conversation_members them
           ON them.conversation_id = c.id AND them.user_id <> me.user_id AND c.type = 'direct'
         LEFT JOIN users other ON other.id = them.user_id
        WHERE me.user_id = $1
        ORDER BY c.updated_at DESC`,
      [userId]
    );

    return ok(res, {
      conversations: rows.map((row) => ({
        id: Number(row.id),
        type: row.type || 'direct',
        name: row.name || null,
        avatar_url: row.avatar_url || null,
        member_count: Number(row.member_count || 0),
        updated_at: row.updated_at,
        other_user: row.other_id
          ? {
              id: Number(row.other_id),
              full_name: row.other_full_name,
              username: row.other_username,
              profile_image: row.other_profile_image || null,
              is_online: Boolean(row.other_is_online),
              last_seen: row.other_last_seen || null,
            }
          : null,
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
 * POST /api/conversations
 * Body: { username } for direct, or { name, member_usernames: [] } for group.
 */
async function create(req, res, next) {
  try {
    // Group creation
    if (req.body.name) {
      const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
      if (!name || name.length > 80) return fail(res, 'Group name is required (max 80 chars).', 422);
      const usernames = Array.isArray(req.body.member_usernames) ? req.body.member_usernames : [];
      if (usernames.length < 1) return fail(res, 'Add at least one member.', 422);

      const found = await query(
        'SELECT id, username FROM users WHERE username = ANY($1)',
        [usernames.map((u) => String(u).trim().toLowerCase())]
      );
      if (found.rowCount !== usernames.length) {
        return fail(res, 'One or more users were not found.', 404);
      }
      const memberIds = found.rows.map((r) => Number(r.id));
      if (memberIds.includes(Number(req.user.id))) {
        return fail(res, 'You are added automatically; remove yourself from the list.', 422);
      }
      const group = await createGroup(req.user.id, name, memberIds, null);
      return ok(res, { id: group.id, type: 'group' }, 'Group created', 201);
    }

    // Direct conversation
    const username = typeof req.body.username === 'string' ? req.body.username.trim().toLowerCase() : '';
    if (!username) return fail(res, 'Username is required.', 422);

    const { rows } = await query('SELECT id FROM users WHERE username = $1 LIMIT 1', [username]);
    if (!rows.length) return fail(res, 'User not found.', 404);
    if (Number(rows[0].id) === Number(req.user.id)) {
      return fail(res, 'You cannot start a conversation with yourself.', 422);
    }

    const { id, created } = await findOrCreateConversation(req.user.id, Number(rows[0].id));
    return ok(res, { id, type: 'direct' }, created ? 'Conversation created' : 'Conversation exists', created ? 201 : 200);
  } catch (error) {
    return next(error);
  }
}

/**
 * GET /api/conversations/:id — info for direct or group.
 */
async function getOne(req, res, next) {
  try {
    const conversationId = Number(req.params.id);
    const membership = await getMembership(conversationId, req.user.id);
    if (!membership) return fail(res, 'Conversation not found.', 404);

    const { conversation, members, isGroup, other } = membership;
    return ok(res, {
      id: conversation.id,
      type: conversation.type,
      name: conversation.name,
      avatar_url: conversation.avatar_url,
      other_user: isGroup ? null : publicUser(other),
      members: isGroup ? members.map((m) => publicUser(m)) : undefined,
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * PUT /api/conversations/:id — rename group or set avatar. Admin only.
 */
async function update(req, res, next) {
  try {
    const conversationId = Number(req.params.id);
    const membership = await getMembership(conversationId, req.user.id);
    if (!membership) return fail(res, 'Conversation not found.', 404);
    if (!membership.isGroup) return fail(res, 'Only groups can be renamed.', 422);
    if (membership.role !== 'admin') return fail(res, 'Only group admins can rename.', 403);

    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    if (!name || name.length > 80) return fail(res, 'Group name is required (max 80 chars).', 422);
    await query('UPDATE conversations SET name = $1 WHERE id = $2', [name, conversationId]);
    return ok(res, { id: conversationId, name }, 'Group renamed');
  } catch (error) {
    return next(error);
  }
}

/**
 * POST /api/conversations/:id/members — add members to group. Admin only.
 * Body: { usernames: [] }
 */
async function addMembers(req, res, next) {
  try {
    const conversationId = Number(req.params.id);
    const membership = await getMembership(conversationId, req.user.id);
    if (!membership) return fail(res, 'Conversation not found.', 404);
    if (!membership.isGroup) return fail(res, 'Not a group.', 422);
    if (membership.role !== 'admin') return fail(res, 'Only group admins can add members.', 403);

    const usernames = Array.isArray(req.body.usernames) ? req.body.usernames : [];
    if (!usernames.length) return fail(res, 'No usernames given.', 422);
    const found = await query(
      'SELECT id FROM users WHERE username = ANY($1)',
      [usernames.map((u) => String(u).trim().toLowerCase())]
    );
    if (found.rowCount !== usernames.length) return fail(res, 'One or more users were not found.', 404);

    for (const row of found.rows) {
      await query(
        `INSERT INTO conversation_members (conversation_id, user_id, role)
         VALUES ($1, $2, 'member') ON CONFLICT DO NOTHING`,
        [conversationId, row.id]
      );
    }
    await query('UPDATE conversations SET updated_at = NOW() WHERE id = $1', [conversationId]);
    return ok(res, null, 'Members added');
  } catch (error) {
    return next(error);
  }
}

/**
 * DELETE /api/conversations/:id/members/:userId — remove member (admin) or leave.
 */
async function removeMember(req, res, next) {
  try {
    const conversationId = Number(req.params.id);
    const targetId = Number(req.params.userId);
    const membership = await getMembership(conversationId, req.user.id);
    if (!membership) return fail(res, 'Conversation not found.', 404);
    if (!membership.isGroup) return fail(res, 'Not a group.', 422);

    const leaving = targetId === Number(req.user.id);
    if (!leaving && membership.role !== 'admin') {
      return fail(res, 'Only group admins can remove members.', 403);
    }
    if (leaving && membership.role === 'admin') {
      const otherAdmins = membership.members.filter((m) => m.role === 'admin' && m.id !== Number(req.user.id));
      if (!otherAdmins.length && membership.members.length > 1) {
        return fail(res, 'Promote another admin before leaving (Settings in a group chat).', 422);
      }
    }

    await query(
      'DELETE FROM conversation_members WHERE conversation_id = $1 AND user_id = $2',
      [conversationId, targetId]
    );
    if (membership.members.length - 1 < 2) {
      // A group cannot go below 2 members; delete it entirely.
      await query('DELETE FROM conversations WHERE id = $1', [conversationId]);
      return ok(res, null, leaving ? 'Group deleted' : 'Group deleted');
    }
    return ok(res, null, leaving ? 'You left the group' : 'Member removed');
  } catch (error) {
    return next(error);
  }
}

/**
 * DELETE /api/conversations/:id — hides the conversation for the requester.
 */
async function remove(req, res, next) {
  try {
    const conversationId = Number(req.params.id);
    const membership = await getMembership(conversationId, req.user.id);
    if (!membership) return fail(res, 'Conversation not found.', 404);

    await query(
      `INSERT INTO message_deletions (message_id, user_id)
       SELECT id, $2 FROM messages WHERE conversation_id = $1
       ON CONFLICT DO NOTHING`,
      [conversationId, req.user.id]
    );
    await query(
      'UPDATE conversation_members SET last_read_at = NOW() WHERE conversation_id = $1 AND user_id = $2',
      [conversationId, req.user.id]
    );
    return ok(res, null, 'Conversation deleted for you');
  } catch (error) {
    return next(error);
  }
}

module.exports = { list, create, getOne, update, addMembers, removeMember, remove };
