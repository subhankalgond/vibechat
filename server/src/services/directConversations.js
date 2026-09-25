/**
 * Find an existing 1-to-1 conversation between two users, or create one.
 * Runs inside a transaction; Postgres uniqueness on (conversation_id, user_id)
 * plus a final duplicate check prevents double creation under races.
 */
const { query, withTransaction } = require('../config/db');

async function findConversationBetween(userA, userB, client) {
  const runner = client || { query };
  const { rows } = await runner.query(
    `SELECT cm1.conversation_id AS id
       FROM conversation_members cm1
       JOIN conversation_members cm2
         ON cm1.conversation_id = cm2.conversation_id
      WHERE cm1.user_id = $1 AND cm2.user_id = $2
      LIMIT 1`,
    [userA, userB]
  );
  return rows.length ? { id: rows[0].id, created: false } : null;
}

async function findOrCreateConversation(userA, userB) {
  const existing = await findConversationBetween(userA, userB);
  if (existing) return existing;

  return withTransaction(async (client) => {
    // Serialize pair creation across concurrent requests.
    const pairKey = Math.min(Number(userA), Number(userB)) * 1000000 + Math.max(Number(userA), Number(userB));
    await client.query('SELECT pg_advisory_xact_lock($1)', [pairKey]);

    const again = await findConversationBetween(userA, userB, client);
    if (again) return again;

    const { rows } = await client.query('INSERT INTO conversations DEFAULT VALUES RETURNING id');
    const conversationId = rows[0].id;
    await client.query(
      'INSERT INTO conversation_members (conversation_id, user_id) VALUES ($1, $2), ($1, $3)',
      [conversationId, userA, userB]
    );
    return { id: conversationId, created: true };
  });
}

/**
 * Assert the user is a member and return both member ids.
 */
async function getMembership(conversationId, userId) {
  const { rows } = await query(
    'SELECT user_id FROM conversation_members WHERE conversation_id = $1',
    [conversationId]
  );
  if (rows.length !== 2) return null;
  const memberIds = rows.map((r) => Number(r.user_id));
  if (!memberIds.includes(Number(userId))) return null;
  const otherId = memberIds.find((id) => id !== Number(userId));
  return { memberIds, otherId };
}

module.exports = { findOrCreateConversation, getMembership };
