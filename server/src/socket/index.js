const { getIo } = require('../config/socketIo');
const { query } = require('../config/db');
const { verifyToken } = require('../utils/tokens');
const { getMembership } = require('../services/directConversations');

/** userId -> Set<socketId> */
const onlineUsers = new Map();

/** callId -> { conversationId, callerId, calleeId, callType, startedAt, answered } */
const liveCalls = new Map();
const { recordCall } = require('../controllers/callsController');

function socketsFor(userId) {
  return onlineUsers.get(Number(userId)) || new Set();
}

function isOnline(userId) {
  return socketsFor(userId).size > 0;
}

async function setUserOnline(userId, online) {
  await query(
    'UPDATE users SET is_online = $1, last_seen = NOW() WHERE id = $2',
    [online, userId]
  );
}

function broadcastPresence(userId, online) {
  const io = getIo();
  if (!io) return;
  io.emit('user:presence', {
    user_id: Number(userId),
    is_online: online,
    last_seen: online ? null : new Date().toISOString(),
  });
}

function registerSocketHandlers() {
  const io = getIo();
  if (!io) return;

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth && socket.handshake.auth.token;
      if (!token) return next(new Error('Authentication required'));
      const payload = verifyToken(token);
      socket.userId = Number(payload.sub);
      socket.username = payload.username;
      return next();
    } catch {
      return next(new Error('Invalid or expired session'));
    }
  });

  io.on('connection', async (socket) => {
    const userId = socket.userId;
    const firstConnection = !isOnline(userId);
    if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
    onlineUsers.get(userId).add(socket.id);

    if (firstConnection) {
      await setUserOnline(userId, true).catch(() => {});
      broadcastPresence(userId, true);
    }

    socket.join(`user:${userId}`);

    socket.emit('user:online', { user_id: userId });

    socket.on('conversation:join', async (payload, callback) => {
      try {
        const conversationId = Number(payload && payload.conversation_id);
        const membership = await getMembership(conversationId, userId);
        if (!membership) {
          if (typeof callback === 'function') callback({ success: false, message: 'Not allowed' });
          return;
        }
        socket.join(`conversation:${conversationId}`);
        if (typeof callback === 'function') callback({ success: true });
      } catch {
        if (typeof callback === 'function') callback({ success: false, message: 'Join failed' });
      }
    });

    socket.on('typing:start', (payload) => {
      const conversationId = Number(payload && payload.conversation_id);
      if (!conversationId) return;
      socket.to(`conversation:${conversationId}`).emit('typing:start', {
        conversation_id: conversationId,
        user_id: userId,
        username: socket.username,
      });
    });

    socket.on('typing:stop', (payload) => {
      const conversationId = Number(payload && payload.conversation_id);
      if (!conversationId) return;
      socket.to(`conversation:${conversationId}`).emit('typing:stop', {
        conversation_id: conversationId,
        user_id: userId,
      });
    });

    socket.on('message:delivered', async (payload, callback) => {
      try {
        const conversationId = Number(payload && payload.conversation_id);
        const membership = await getMembership(conversationId, userId);
        if (!membership) {
          if (typeof callback === 'function') callback({ success: false });
          return;
        }
        const { rows } = await query(
          `UPDATE messages SET delivered_at = NOW()
            WHERE conversation_id = $1 AND receiver_id = $2 AND delivered_at IS NULL
            RETURNING id, sender_id, delivered_at`,
          [conversationId, userId]
        );
        for (const row of rows) {
          io.to(`user:${row.sender_id}`).emit('message:delivered', {
            conversation_id: Number(conversationId),
            message_id: Number(row.id),
            delivered_at: row.delivered_at,
          });
        }
        if (typeof callback === 'function') callback({ success: true });
      } catch {
        if (typeof callback === 'function') callback({ success: false });
      }
    });

    socket.on('message:seen', async (payload, callback) => {
      try {
        const conversationId = Number(payload && payload.conversation_id);
        const membership = await getMembership(conversationId, userId);
        if (!membership) {
          if (typeof callback === 'function') callback({ success: false });
          return;
        }
        const { rows } = await query(
          `UPDATE messages SET seen_at = NOW(), delivered_at = COALESCE(delivered_at, NOW())
            WHERE conversation_id = $1 AND receiver_id = $2 AND seen_at IS NULL
            RETURNING id, sender_id, seen_at`,
          [conversationId, userId]
        );
        for (const row of rows) {
          io.to(`user:${row.sender_id}`).emit('message:seen', {
            conversation_id: Number(conversationId),
            message_id: Number(row.id),
            seen_at: row.seen_at,
          });
        }
        if (typeof callback === 'function') callback({ success: true });
      } catch {
        if (typeof callback === 'function') callback({ success: false });
      }
    });

    // ---- Voice / video call signaling (WebRTC pass-through) ----

    socket.on('call:offer', async (payload, callback) => {
      try {
        const conversationId = Number(payload && payload.conversation_id);
        const callType = payload && payload.call_type === 'video' ? 'video' : 'audio';
        const sdp = payload && typeof payload.sdp === 'string' ? payload.sdp : '';
        if (!conversationId || !sdp) {
          if (typeof callback === 'function') callback({ success: false, message: 'Invalid call payload' });
          return;
        }
        const membership = await getMembership(conversationId, userId);
        if (!membership) {
          if (typeof callback === 'function') callback({ success: false, message: 'Not allowed' });
          return;
        }
        if (!isOnline(membership.otherId)) {
          await recordCall({
            conversationId,
            callerId: userId,
            calleeId: membership.otherId,
            callType,
            status: 'missed',
            durationSeconds: 0,
          });
          if (typeof callback === 'function') callback({ success: false, message: 'User is offline' });
          return;
        }
        const { rows } = await query(
          'SELECT id, full_name, username, profile_image FROM users WHERE id = $1 LIMIT 1',
          [userId]
        );
        const me = rows[0] || { id: userId, full_name: '', username: socket.username, profile_image: null };
        // Relay the CALLER's call id so offer/answer/ICE all match on both
        // sides. Generating a different id here made the caller drop the
        // answer (id mismatch) and the call stuck on Ringing/Connecting.
        const rawCallId = payload && typeof payload.call_id === 'string' ? payload.call_id : '';
        const callId = rawCallId && rawCallId.length <= 64 ? rawCallId : `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        io.to(`user:${membership.otherId}`).emit('call:incoming', {
          call_id: callId,
          conversation_id: conversationId,
          call_type: callType,
          sdp,
          from: {
            id: Number(me.id),
            full_name: me.full_name,
            username: me.username,
            profile_image: me.profile_image || null,
          },
        });
        // Track this live call so reject/end can be logged with context.
        liveCalls.set(callId, {
          conversationId,
          callerId: userId,
          calleeId: membership.otherId,
          callType,
          startedAt: Date.now(),
          answered: false,
        });
        if (typeof callback === 'function') callback({ success: true, call_id: callId });
      } catch {
        if (typeof callback === 'function') callback({ success: false, message: 'Call failed' });
      }
    });

    socket.on('call:answer', (payload) => {
      const toUserId = Number(payload && payload.to_user_id);
      const sdp = payload && typeof payload.sdp === 'string' ? payload.sdp : '';
      if (!toUserId || !sdp) return;
      const callId = payload && typeof payload.call_id === 'string' ? payload.call_id : '';
      const live = liveCalls.get(callId);
      if (live) live.answered = true;
      io.to(`user:${toUserId}`).emit('call:answered', {
        call_id: payload.call_id,
        sdp,
        from_id: userId,
      });
    });

    socket.on('call:ice-candidate', (payload) => {
      const toUserId = Number(payload && payload.to_user_id);
      if (!toUserId) return;
      io.to(`user:${toUserId}`).emit('call:ice', {
        call_id: payload.call_id,
        candidate: payload.candidate,
        from_id: userId,
      });
    });

    socket.on('call:reject', async (payload) => {
      const toUserId = Number(payload && payload.to_user_id);
      if (!toUserId) return;
      const callId = payload && typeof payload.call_id === 'string' ? payload.call_id : '';
      const live = liveCalls.get(callId);
      if (live) {
        await recordCall({
          conversationId: live.conversationId,
          callerId: live.callerId,
          calleeId: live.calleeId,
          callType: live.callType,
          status: 'declined',
          durationSeconds: 0,
        });
        liveCalls.delete(callId);
      }
      io.to(`user:${toUserId}`).emit('call:rejected', {
        call_id: payload && payload.call_id,
        from_id: userId,
      });
    });

    socket.on('call:end', async (payload) => {
      const toUserId = Number(payload && payload.to_user_id);
      if (!toUserId) return;
      const callId = payload && typeof payload.call_id === 'string' ? payload.call_id : '';
      const live = liveCalls.get(callId);
      if (live) {
        const durationSeconds = Math.round((Date.now() - live.startedAt) / 1000);
        await recordCall({
          conversationId: live.conversationId,
          callerId: live.callerId,
          calleeId: live.calleeId,
          callType: live.callType,
          status: live.answered ? 'completed' : 'cancelled',
          durationSeconds: live.answered ? durationSeconds : 0,
        });
        liveCalls.delete(callId);
      }
      io.to(`user:${toUserId}`).emit('call:ended', {
        call_id: payload && payload.call_id,
        from_id: userId,
        reason: payload.reason || 'hangup',
      });
    });

    socket.on('disconnect', async () => {
      const sockets = onlineUsers.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) onlineUsers.delete(userId);
      }
      if (!isOnline(userId)) {
        await setUserOnline(userId, false).catch(() => {});
        broadcastPresence(userId, false);
      }
    });
  });
}

/**
 * Called after a message row is inserted. Pushes to both members.
 * Includes the sender's public profile so receivers can render new
 * chat list entries without an extra API round trip.
 */
async function emitNewMessage(conversationId, memberIds, message) {
  const io = getIo();
  if (!io) return;
  let sender = null;
  try {
    const { rows } = await query(
      'SELECT id, full_name, username, profile_image, is_online, last_seen FROM users WHERE id = $1 LIMIT 1',
      [message.sender_id]
    );
    if (rows.length) {
      const row = rows[0];
      sender = {
        id: Number(row.id),
        full_name: row.full_name,
        username: row.username,
        profile_image: row.profile_image || null,
        is_online: Boolean(row.is_online),
        last_seen: row.last_seen || null,
      };
    }
  } catch {
    sender = null;
  }
  for (const memberId of memberIds) {
    io.to(`user:${memberId}`).emit('message:new', {
      conversation_id: Number(conversationId),
      message: memberId === message.sender_id ? message : { ...message, sender },
    });
  }
}

/**
 * Called after seen status changes. Pushes updated message to both members.
 */
function emitMessageSeen(conversationId, memberIds, message) {
  const io = getIo();
  if (!io) return;
  for (const memberId of memberIds) {
    io.to(`user:${memberId}`).emit('message:seen', {
      conversation_id: Number(conversationId),
      message_id: Number(message.id),
      seen_at: message.seen_at,
    });
  }
}

/**
 * Called when a user deletes a message for themselves (or the sender for all).
 */
function emitMessageDeleted(conversationId, memberIds, messageId, deletedBy, forEveryone = false) {
  const io = getIo();
  if (!io) return;
  for (const memberId of memberIds) {
    io.to(`user:${memberId}`).emit('message:deleted', {
      conversation_id: Number(conversationId),
      message_id: Number(messageId),
      deleted_by: Number(deletedBy),
      for_everyone: Boolean(forEveryone),
    });
  }
}

/**
 * Called after a message is edited.
 */
function emitMessageEdited(conversationId, memberIds, message) {
  const io = getIo();
  if (!io) return;
  for (const memberId of memberIds) {
    io.to(`user:${memberId}`).emit('message:edited', {
      conversation_id: Number(conversationId),
      message,
    });
  }
}

/**
 * Called after reactions change on a message.
 */
function emitMessageReaction(conversationId, memberIds, messageId, reactions) {
  const io = getIo();
  if (!io) return;
  for (const memberId of memberIds) {
    io.to(`user:${memberId}`).emit('message:reaction', {
      conversation_id: Number(conversationId),
      message_id: Number(messageId),
      reactions,
    });
  }
}

module.exports = {
  registerSocketHandlers,
  emitNewMessage,
  emitMessageSeen,
  emitMessageDeleted,
  emitMessageEdited,
  emitMessageReaction,
  socketsFor,
  isOnline: (userId) => isOnline(userId),
};
