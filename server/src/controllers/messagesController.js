const { query } = require('../config/db');
const { ok, fail } = require('../utils/serialize');
const { getMembership } = require('../services/directConversations');

const PAGE_SIZE = 30;

function serializeMessage(row, currentUserId) {
  return {
    id: Number(row.id),
    conversation_id: Number(row.conversation_id),
    sender_id: Number(row.sender_id),
    receiver_id: Number(row.receiver_id),
    message_type: row.message_type,
    message_text: row.message_text || '',
    media_url: row.media_url || null,
    media_public_id: row.media_public_id || null,
    media_type: row.media_type || null,
    file_name: row.file_name || null,
    file_size: row.file_size === null || row.file_size === undefined ? null : Number(row.file_size),
    created_at: row.created_at,
    delivered_at: row.delivered_at || null,
    seen_at: row.seen_at || null,
    is_mine: Number(row.sender_id) === Number(currentUserId),
  };
}

/**
 * GET /api/messages/:conversationId?before=<iso>&limit=30&q=search
 * Returns the latest page (or the page before `before`), oldest first.
 */
async function list(req, res, next) {
  try {
    const conversationId = Number(req.params.conversationId);
    const membership = await getMembership(conversationId, req.user.id);
    if (!membership) return fail(res, 'Conversation not found.', 404);

    const limitRaw = Number.parseInt(req.query.limit, 10);
    const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? limitRaw : PAGE_SIZE, 1), 50);
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';

    const before = typeof req.query.before === 'string' ? req.query.before : null;
    const params = [];
    let where = 'm.conversation_id = $1 AND NOT EXISTS (SELECT 1 FROM message_deletions d WHERE d.message_id = m.id AND d.user_id = $2)';
    params.push(conversationId, req.user.id);

    if (before) {
      const cursor = new Date(before);
      if (!Number.isNaN(cursor.getTime())) {
        params.push(cursor.toISOString());
        where += ` AND m.created_at < $${params.length}`;
      }
    }
    if (q) {
      params.push(`%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`);
      where += ` AND m.message_text LIKE $${params.length}`;
    }

    params.push(limit + 1);
    const { rows } = await query(
      `SELECT m.* FROM messages m
        WHERE ${where}
        ORDER BY m.created_at DESC, m.id DESC
        LIMIT $${params.length}`,
      params
    );

    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit).reverse();
    return ok(res, {
      messages: page.map((row) => serializeMessage(row, req.user.id)),
      has_more: hasMore,
      next_before: page.length ? page[0].created_at : null,
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * POST /api/messages
 * Body: { conversation_id, message_type, message_text?, media? }
 */
async function send(req, res, next) {
  try {
    const conversationId = Number(req.body.conversation_id);
    const membership = await getMembership(conversationId, req.user.id);
    if (!membership) return fail(res, 'Conversation not found.', 404);

    const type = req.body.message_type;
    if (!['text', 'image', 'video'].includes(type)) {
      return fail(res, 'Invalid message type.', 422);
    }

    const text = typeof req.body.message_text === 'string' ? req.body.message_text.trim() : '';
    if (type === 'text' && !text) return fail(res, 'Message cannot be empty.', 422);
    if (type !== 'text' && !req.body.media) {
      return fail(res, 'Media is required for this message type.', 422);
    }
    if (text.length > 4000) {
      return fail(res, 'Message is too long. Max 4000 characters.', 422);
    }

    let media = null;
    if (req.body.media) {
      const m = req.body.media;
      const valid =
        typeof m.media_url === 'string' && m.media_url.startsWith('https://') &&
        typeof m.media_public_id === 'string' && m.media_public_id.length > 0;
      if (!valid) return fail(res, 'Invalid media payload.', 422);
      media = {
        url: m.media_url,
        publicId: m.media_public_id,
        mediaType: m.media_type === 'video' ? 'video' : 'image',
        fileName: typeof m.file_name === 'string' ? m.file_name.slice(0, 255) : null,
        fileSize: Number.isFinite(Number(m.file_size)) ? Number(m.file_size) : null,
      };
    }

    const { rows } = await query(
      `INSERT INTO messages
        (conversation_id, sender_id, receiver_id, message_type, message_text,
         media_url, media_public_id, media_type, file_name, file_size)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        conversationId,
        req.user.id,
        membership.otherId,
        type,
        type === 'text' ? text : text || null,
        media ? media.url : null,
        media ? media.publicId : null,
        media ? media.mediaType : null,
        media ? media.fileName : null,
        media ? media.fileSize : null,
      ]
    );
    const message = serializeMessage(rows[0], req.user.id);

    await query('UPDATE conversations SET updated_at = NOW() WHERE id = $1', [conversationId]);
    await query(
      'UPDATE conversation_members SET last_read_at = NOW() WHERE conversation_id = $1 AND user_id = $2',
      [conversationId, req.user.id]
    );

    // If the receiver has a live socket, record delivery and tell the sender.
    const socketModule = require('../socket/index');
    const { getIo } = require('../config/socketIo');
    let deliveredAt = null;
    if (socketModule.isOnline(membership.otherId)) {
      const { rows: updated } = await query(
        'UPDATE messages SET delivered_at = NOW() WHERE id = $1 RETURNING delivered_at',
        [message.id]
      );
      deliveredAt = updated[0].delivered_at;
    }
    const messageForSender = deliveredAt ? { ...message, delivered_at: deliveredAt } : message;

    socketModule.emitNewMessage(conversationId, membership.memberIds, message);
    const io = getIo();
    if (io && deliveredAt) {
      io.to(`user:${req.user.id}`).emit('message:delivered', {
        conversation_id: Number(conversationId),
        message_id: Number(message.id),
        delivered_at: deliveredAt,
      });
    }

    return ok(res, { message: messageForSender }, 'Message sent', 201);
  } catch (error) {
    return next(error);
  }
}

/**
 * PUT /api/messages/:id/seen
 */
async function seen(req, res, next) {
  try {
    const messageId = Number(req.params.id);
    const { rows } = await query('SELECT * FROM messages WHERE id = $1 LIMIT 1', [messageId]);
    const row = rows[0];
    if (!row) return fail(res, 'Message not found.', 404);

    const membership = await getMembership(row.conversation_id, req.user.id);
    if (!membership) return fail(res, 'Message not found.', 404);
    if (Number(row.sender_id) === Number(req.user.id)) {
      return fail(res, 'Only the receiver can mark a message as seen.', 403);
    }

    const { rows: updated } = await query(
      `UPDATE messages
          SET seen_at = COALESCE(seen_at, NOW()),
              delivered_at = COALESCE(delivered_at, NOW())
        WHERE id = $1 AND receiver_id = $2
        RETURNING *`,
      [messageId, req.user.id]
    );
    const message = serializeMessage(updated[0], req.user.id);
    const { emitMessageSeen } = require('../socket/index');
    emitMessageSeen(row.conversation_id, membership.memberIds, message);
    return ok(res, { message });
  } catch (error) {
    return next(error);
  }
}

/**
 * DELETE /api/messages/:id  (delete for me only)
 */
async function deleteForMe(req, res, next) {
  try {
    const messageId = Number(req.params.id);
    const { rows } = await query('SELECT * FROM messages WHERE id = $1 LIMIT 1', [messageId]);
    const row = rows[0];
    if (!row) return fail(res, 'Message not found.', 404);

    const membership = await getMembership(row.conversation_id, req.user.id);
    if (!membership) return fail(res, 'Message not found.', 404);
    if (Number(row.sender_id) !== Number(req.user.id)) {
      return fail(res, 'You can only delete your own messages.', 403);
    }

    await query(
      `INSERT INTO message_deletions (message_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [messageId, req.user.id]
    );
    const { emitMessageDeleted } = require('../socket/index');
    emitMessageDeleted(row.conversation_id, membership.memberIds, messageId, req.user.id);
    return ok(res, null, 'Message deleted');
  } catch (error) {
    return next(error);
  }
}

module.exports = { list, send, seen, deleteForMe };
