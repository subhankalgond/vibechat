const { getIo } = require('../config/socketIo');
const { query } = require('../config/db');
const { verifyToken } = require('../utils/tokens');
const { getMembership } = require('../services/directConversations');

/** userId -> Set<socketId> */
const onlineUsers = new Map();

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
 */
function emitNewMessage(conversationId, memberIds, message) {
  const io = getIo();
  if (!io) return;
  for (const memberId of memberIds) {
    io.to(`user:${memberId}`).emit('message:new', { conversation_id: Number(conversationId), message });
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
 * Called when a user deletes a message for themselves.
 */
function emitMessageDeleted(conversationId, memberIds, messageId, deletedBy) {
  const io = getIo();
  if (!io) return;
  for (const memberId of memberIds) {
    io.to(`user:${memberId}`).emit('message:deleted', {
      conversation_id: Number(conversationId),
      message_id: Number(messageId),
      deleted_by: Number(deletedBy),
    });
  }
}

module.exports = {
  registerSocketHandlers,
  emitNewMessage,
  emitMessageSeen,
  emitMessageDeleted,
  socketsFor,
  isOnline: (userId) => isOnline(userId),
};
