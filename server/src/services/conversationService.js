/**
 * Group-aware conversation helpers. Direct chats have exactly 2 members;
 * groups have 2+ with an admin. All membership checks for both kinds now
 * flow through getMembership so controllers stay group-safe.
 */
const { query } = require('../config/db');

/**
 * Membership check that works for direct AND group conversations.
 * Returns { conversation, members, role, isDirect, isGroup, otherId|null }.
 */
async function getMembership(conversationId, userId) {
  const { rows } = await query(
    `SELECT c.id, c.type, c.name, c.avatar_url, c.created_by
       FROM conversations c
       JOIN conversation_members cm ON cm.conversation_id = c.id AND cm.user_id = $2
      WHERE c.id = $1
      LIMIT 1`,
    [conversationId, userId]
  );
  if (!rows.length) return null;
  const conversation = {
    id: Number(rows[0].id),
    type: rows[0].type || 'direct',
    name: rows[0].name || null,
    avatar_url: rows[0].avatar_url || null,
    created_by: rows[0].created_by === null || rows[0].created_by === undefined ? null : Number(rows[0].created_by),
  };
  const isGroup = conversation.type === 'group';

  const { rows: memberRows } = await query(
    `SELECT cm.user_id, cm.role, u.full_name, u.username, u.profile_image, u.is_online, u.last_seen
       FROM conversation_members cm JOIN users u ON u.id = cm.user_id
      WHERE cm.conversation_id = $1
      ORDER BY cm.joined_at`,
    [conversationId]
  );

  const members = memberRows.map((r) => ({
    id: Number(r.user_id),
    role: r.role || 'member',
    full_name: r.full_name,
    username: r.username,
    profile_image: r.profile_image || null,
    is_online: Boolean(r.is_online),
    last_seen: r.last_seen || null,
  }));

  const mine = memberRows.find((r) => Number(r.user_id) === Number(userId));
  const other = isGroup ? null : members.find((m) => m.id !== Number(userId)) || null;

  return {
    conversation,
    members,
    role: (mine && mine.role) || 'member',
    isGroup,
    isDirect: !isGroup,
    otherId: other ? other.id : null,
    other,
  };
}

/**
 * Create a group conversation. creator becomes 'admin'.
 */
async function createGroup(creatorId, name, memberIds, avatarUrl) {
  const { rows } = await query('INSERT INTO conversations (type, name, avatar_url, created_by) VALUES ($1, $2, $3, $4) RETURNING id', ['group', name, avatarUrl || null, creatorId]);
  const conversationId = rows[0].id;
  const unique = [...new Set([Number(creatorId), ...memberIds.map(Number)])];
  const values = [];
  const params = [conversationId];
  unique.forEach((id, index) => {
    values.push(`($1, $${index * 2 + 2}, $${index * 2 + 3})`);
    params.push(id, id === Number(creatorId) ? 'admin' : 'member');
  });
  await query(
    `INSERT INTO conversation_members (conversation_id, user_id, role) VALUES ${values.join(', ')}`,
    params
  );
  return { id: Number(conversationId) };
}

/**
 * Generate a short unique invite code for communities.
 */
function makeInviteCode() {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  let code = '';
  for (let i = 0; i < 8; i += 1) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  return code;
}

module.exports = { getMembership, createGroup, makeInviteCode };
