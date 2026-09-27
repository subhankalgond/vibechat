const { query } = require('../config/db');
const { ok, fail } = require('../utils/serialize');
const { getMembership } = require('../services/conversationService');

const PAGE_SIZE = 30;
const ALLOWED_TYPES = ['text', 'image', 'video', 'audio'];
const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥'];

function serializeMessage(row, currentUserId) {
  return {
    id: Number(row.id),
    conversation_id: Number(row.conversation_id),
    sender_id: Number(row.sender_id),
    receiver_id: row.receiver_id === null || row.receiver_id === undefined ? null : Number(row.receiver_id),
    message_type: row.message_type,
    message_text: row.message_text || '',
    media_url: row.media_url || null,
    media_public_id: row.media_public_id || null,
    media_type: row.media_type || null,
    file_name: row.file_name || null,
    file_size: row.file_size === null || row.file_size === undefined ? null : Number(row.file_size),
    duration_seconds: row.duration_seconds === null || row.duration_seconds === undefined ? null : Number(row.duration_seconds),
    reply_to_id: row.reply_to_id === null || row.reply_to_id === undefined ? null : Number(row.reply_to_id),
    edited_at: row.edited_at || null,
    disappears_after_seconds: row.disappears_after_seconds === null || row.disappears_after_seconds === undefined ? null : Number(row.disappears_after_seconds),
    created_at: row.created_at,
    delivered_at: row.delivered_at || null,
    seen_at: row.seen_at || null,
    is_mine: Number(row.sender_id) === Number(currentUserId),
  };
}

function isExpired(message) {
  if (!message.disappears_after_seconds) return false;
  const created = new Date(message.created_at).getTime();
  return Date.now() >= created + message.disappears_after_seconds * 1000;
}

/**
 * GET /api/messages/:conversationId?before=<iso>&limit=30&q=search
 * Hides expired disappearing messages from the response (lazy sweep).
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
    const params = [conversationId, req.user.id];
    let where =
      'm.conversation_id = $1 AND NOT EXISTS (SELECT 1 FROM message_deletions d WHERE d.message_id = m.id AND d.user_id = $2)' +
      ' AND (m.disappears_after_seconds IS NULL OR m.created_at + (m.disappears_after_seconds * INTERVAL \'1 second\') > NOW())';

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
    const ids = page.map((r) => r.id);

    // Reactions + reply previews for the page.
    let reactions = [];
    let replies = [];
    if (ids.length) {
      const r1 = await query(
        'SELECT message_id, user_id, emoji FROM message_reactions WHERE message_id = ANY($1)',
        [ids]
      );
      reactions = r1.rows;
      const r2 = await query(
        `SELECT m.id, m.reply_to_id, p.message_text AS parent_text, p.message_type AS parent_type, pu.full_name AS parent_sender
           FROM messages m JOIN messages p ON p.id = m.reply_to_id JOIN users pu ON pu.id = p.sender_id
          WHERE m.id = ANY($1) AND m.reply_to_id IS NOT NULL`,
        [ids]
      );
      replies = r2.rows;
    }

    const senderNames = new Map(membership.members.map((m) => [m.id, m.full_name]));
    const messages = page.map((row) => {
      const serialized = serializeMessage(row, req.user.id);
      serialized.reactions = reactions
        .filter((r) => Number(r.message_id) === Number(row.id))
        .map((r) => ({ user_id: Number(r.user_id), emoji: r.emoji }));
      const reply = replies.find((r) => Number(r.id) === Number(row.id));
      serialized.reply_to = reply
        ? {
            id: Number(reply.reply_to_id),
            text: reply.parent_text || '',
            type: reply.parent_type,
            sender_name: reply.parent_sender,
          }
        : null;
      if (membership.isGroup && !serialized.is_mine) {
        serialized.sender_name = senderNames.get(serialized.sender_id) || null;
      }
      return serialized;
    });

    return ok(res, {
      messages,
      has_more: hasMore,
      next_before: page.length ? page[0].created_at : null,
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * POST /api/messages
 * Body: { conversation_id, message_type, message_text?, media?, reply_to_id?, disappears_after_seconds? }
 */
async function send(req, res, next) {
  try {
    const conversationId = Number(req.body.conversation_id);
    const membership = await getMembership(conversationId, req.user.id);
    if (!membership) return fail(res, 'Conversation not found.', 404);

    const type = req.body.message_type;
    if (!ALLOWED_TYPES.includes(type)) return fail(res, 'Invalid message type.', 422);

    const text = typeof req.body.message_text === 'string' ? req.body.message_text.trim() : '';
    if (type === 'text' && !text) return fail(res, 'Message cannot be empty.', 422);
    if (type !== 'text' && !req.body.media) {
      return fail(res, 'Media is required for this message type.', 422);
    }
    if (text.length > 4000) return fail(res, 'Message is too long. Max 4000 characters.', 422);

    // Reply target must belong to the same conversation.
    let replyToId = null;
    if (req.body.reply_to_id !== undefined && req.body.reply_to_id !== null) {
      const candidate = Number(req.body.reply_to_id);
      const { rows: parent } = await query(
        'SELECT id FROM messages WHERE id = $1 AND conversation_id = $2 LIMIT 1',
        [candidate, conversationId]
      );
      if (!parent.length) return fail(res, 'Reply target not found.', 422);
      replyToId = candidate;
    }

    // Disappearing: 0 disables, otherwise 1h / 24h / 7d are allowed.
    let disappearsAfter = null;
    if (req.body.disappears_after_seconds !== undefined && req.body.disappears_after_seconds !== null) {
      const n = Number(req.body.disappears_after_seconds);
      if (!Number.isFinite(n) || ![0, 3600, 86400, 604800].includes(n)) {
        return fail(res, 'Invalid disappearing timer.', 422);
      }
      if (n > 0) disappearsAfter = n;
    }

    let media = null;
    if (req.body.media) {
      const m = req.body.media;
      const valid =
        (typeof m.media_url === 'string' && (m.media_url.startsWith('https://') || m.media_url.includes('/api/media/'))) &&
        (typeof m.media_public_id === 'string' && m.media_public_id.length > 0);
      if (!valid) return fail(res, 'Invalid media payload.', 422);
      media = {
        url: m.media_url,
        publicId: m.media_public_id,
        mediaType: m.media_type === 'video' ? 'video' : m.media_type === 'audio' ? 'audio' : 'image',
        fileName: typeof m.file_name === 'string' ? m.file_name.slice(0, 255) : null,
        fileSize: Number.isFinite(Number(m.file_size)) ? Number(m.file_size) : null,
      };
    }

    const { rows } = await query(
      `INSERT INTO messages
        (conversation_id, sender_id, receiver_id, message_type, message_text,
         media_url, media_public_id, media_type, file_name, file_size,
         reply_to_id, disappears_after_seconds)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
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
        replyToId,
        disappearsAfter,
      ]
    );
    const message = serializeMessage(rows[0], req.user.id);

    await query('UPDATE conversations SET updated_at = NOW() WHERE id = $1', [conversationId]);
    await query(
      'UPDATE conversation_members SET last_read_at = NOW() WHERE conversation_id = $1 AND user_id = $2',
      [conversationId, req.user.id]
    );

    // Direct chats: delivery receipt when receiver has a live socket.
    let deliveredAt = null;
    if (membership.isDirect && membership.otherId) {
      const socketModule = require('../socket/index');
      if (socketModule.isOnline(membership.otherId)) {
        const { rows: updated } = await query(
          'UPDATE messages SET delivered_at = NOW() WHERE id = $1 RETURNING delivered_at',
          [message.id]
        );
        deliveredAt = updated[0].delivered_at;
      }
    }
    const messageForSender = deliveredAt ? { ...message, delivered_at: deliveredAt } : message;

    require('../socket/index').emitNewMessage(conversationId, membership.members.map((m) => m.id), messageForSender);
    if (deliveredAt) {
      const { getIo } = require('../config/socketIo');
      const io = getIo();
      if (io) {
        io.to(`user:${req.user.id}`).emit('message:delivered', {
          conversation_id: conversationId,
          message_id: message.id,
          delivered_at: deliveredAt,
        });
      }
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

    // Respect receiver's read-receipt privacy setting.
    const { rows: receiverRows } = await query(
      'SELECT read_receipts_enabled FROM users WHERE id = $1 LIMIT 1',
      [req.user.id]
    );
    if (receiverRows.length && receiverRows[0].read_receipts_enabled === false) {
      // Still mark delivered so the pipeline stays consistent, but not seen.
      await query(
        'UPDATE messages SET delivered_at = COALESCE(delivered_at, NOW()) WHERE id = $1',
        [messageId]
      );
      return ok(res, { message: serializeMessage({ ...row, delivered_at: new Date().toISOString() }, req.user.id) });
    }

    const { rows: updated } = await query(
      `UPDATE messages
          SET seen_at = COALESCE(seen_at, NOW()),
              delivered_at = COALESCE(delivered_at, NOW())
        WHERE id = $1
        RETURNING *`,
      [messageId]
    );
    const message = serializeMessage(updated[0], req.user.id);
    require('../socket/index').emitMessageSeen(row.conversation_id, membership.members.map((m) => m.id), message);
    return ok(res, { message });
  } catch (error) {
    return next(error);
  }
}

/**
 * PUT /api/messages/:id — edit own text message.
 */
async function edit(req, res, next) {
  try {
    const messageId = Number(req.params.id);
    const text = typeof req.body.message_text === 'string' ? req.body.message_text.trim() : '';
    if (!text) return fail(res, 'Message cannot be empty.', 422);
    if (text.length > 4000) return fail(res, 'Message is too long. Max 4000 characters.', 422);

    const { rows } = await query('SELECT * FROM messages WHERE id = $1 LIMIT 1', [messageId]);
    const row = rows[0];
    if (!row) return fail(res, 'Message not found.', 404);
    if (Number(row.sender_id) !== Number(req.user.id)) return fail(res, 'You can only edit your own messages.', 403);
    if (row.message_type !== 'text') return fail(res, 'Only text messages can be edited.', 422);

    const membership = await getMembership(row.conversation_id, req.user.id);
    if (!membership) return fail(res, 'Message not found.', 404);

    const { rows: updated } = await query(
      'UPDATE messages SET message_text = $1, edited_at = NOW() WHERE id = $2 RETURNING *',
      [text, messageId]
    );
    const message = serializeMessage(updated[0], req.user.id);
    require('../socket/index').emitMessageEdited(row.conversation_id, membership.members.map((m) => m.id), message);
    return ok(res, { message }, 'Message edited');
  } catch (error) {
    return next(error);
  }
}

/**
 * POST /api/messages/:id/reactions — toggle emoji.
 * Body: { emoji } (empty string removes).
 */
async function react(req, res, next) {
  try {
    const messageId = Number(req.params.id);
    const emoji = typeof req.body.emoji === 'string' ? req.body.emoji : '';
    if (emoji && !REACTIONS.includes(emoji)) return fail(res, 'Unsupported reaction.', 422);

    const { rows } = await query('SELECT * FROM messages WHERE id = $1 LIMIT 1', [messageId]);
    const row = rows[0];
    if (!row) return fail(res, 'Message not found.', 404);
    const membership = await getMembership(row.conversation_id, req.user.id);
    if (!membership) return fail(res, 'Message not found.', 404);

    let myReaction = null;
    if (!emoji) {
      await query('DELETE FROM message_reactions WHERE message_id = $1 AND user_id = $2', [messageId, req.user.id]);
    } else {
      const { rows: existing } = await query(
        'SELECT emoji FROM message_reactions WHERE message_id = $1 AND user_id = $2 LIMIT 1',
        [messageId, req.user.id]
      );
      if (existing.length && existing[0].emoji === emoji) {
        // Same emoji again = toggle off.
        await query('DELETE FROM message_reactions WHERE message_id = $1 AND user_id = $2', [messageId, req.user.id]);
      } else {
        await query(
          `INSERT INTO message_reactions (message_id, user_id, emoji) VALUES ($1, $2, $3)
           ON CONFLICT (message_id, user_id) DO UPDATE SET emoji = EXCLUDED.emoji, created_at = NOW()`,
          [messageId, req.user.id, emoji]
        );
        myReaction = emoji;
      }
    }

    const { rows: all } = await query(
      'SELECT user_id, emoji FROM message_reactions WHERE message_id = $1',
      [messageId]
    );
    const reactions = all.map((r) => ({ user_id: Number(r.user_id), emoji: r.emoji }));
    require('../socket/index').emitMessageReaction(
      row.conversation_id,
      membership.members.map((m) => m.id),
      messageId,
      reactions
    );
    return ok(res, { message_id: messageId, reactions, my_reaction: myReaction }, 'Reaction updated');
  } catch (error) {
    return next(error);
  }
}

/**
 * DELETE /api/messages/:id?for=everyone — delete for me (any member, own view)
 * or for everyone (sender only, within 1 hour).
 */
async function deleteForMe(req, res, next) {
  try {
    const messageId = Number(req.params.id);
    const forEveryone = req.query.for === 'everyone';
    const { rows } = await query('SELECT * FROM messages WHERE id = $1 LIMIT 1', [messageId]);
    const row = rows[0];
    if (!row) return fail(res, 'Message not found.', 404);

    const membership = await getMembership(row.conversation_id, req.user.id);
    if (!membership) return fail(res, 'Message not found.', 404);

    if (forEveryone) {
      if (Number(row.sender_id) !== Number(req.user.id)) {
        return fail(res, 'You can only delete your own messages for everyone.', 403);
      }
      const ageMs = Date.now() - new Date(row.created_at).getTime();
      if (ageMs > 60 * 60 * 1000) {
        return fail(res, 'Messages can be deleted for everyone within 1 hour of sending.', 403);
      }
      await query('DELETE FROM messages WHERE id = $1', [messageId]);
      require('../socket/index').emitMessageDeleted(
        row.conversation_id,
        membership.members.map((m) => m.id),
        messageId,
        req.user.id,
        true
      );
      return ok(res, null, 'Message deleted for everyone');
    }

    await query(
      `INSERT INTO message_deletions (message_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [messageId, req.user.id]
    );
    require('../socket/index').emitMessageDeleted(
      row.conversation_id,
      membership.members.map((m) => m.id),
      messageId,
      req.user.id,
      false
    );
    return ok(res, null, 'Message deleted');
  } catch (error) {
    return next(error);
  }
}

module.exports = { list, send, seen, edit, react, deleteForMe, REACTIONS, isExpired };
