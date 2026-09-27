const { query } = require('../config/db');
const { ok, fail } = require('../utils/serialize');

/**
 * GET /api/calls — call history for the signed-in user.
 */
async function list(req, res, next) {
  try {
    const userId = Number(req.user.id);
    const { rows } = await query(
      `SELECT ch.id, ch.conversation_id, ch.caller_id, ch.callee_id, ch.call_type, ch.status,
              ch.started_at, ch.ended_at, ch.duration_seconds,
              cu.id AS caller_id2, cu.full_name AS caller_name, cu.username AS caller_username, cu.profile_image AS caller_image,
              eu.id AS callee_id2, eu.full_name AS callee_name, eu.username AS callee_username, eu.profile_image AS callee_image
         FROM call_history ch
         JOIN users cu ON cu.id = ch.caller_id
         JOIN users eu ON eu.id = ch.callee_id
        WHERE ch.caller_id = $1 OR ch.callee_id = $1
        ORDER BY ch.started_at DESC
        LIMIT 100`,
      [userId]
    );
    return ok(res, {
      calls: rows.map((r) => {
        const outgoing = Number(r.caller_id) === userId;
        const counterpartId = outgoing ? Number(r.callee_id) : Number(r.caller_id);
        return {
          id: Number(r.id),
          conversation_id: Number(r.conversation_id),
          direction: outgoing ? 'outgoing' : 'incoming',
          call_type: r.call_type,
          status: r.status,
          started_at: r.started_at,
          duration_seconds: Number(r.duration_seconds || 0),
          counterpart: {
            id: counterpartId,
            full_name: outgoing ? r.callee_name : r.caller_name,
            username: outgoing ? r.callee_username : r.caller_username,
            profile_image: outgoing ? (r.callee_image || null) : (r.caller_image || null),
          },
        };
      }),
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * DELETE /api/calls/:id — remove one entry (either participant).
 */
async function remove(req, res, next) {
  try {
    const id = Number(req.params.id);
    const { rowCount } = await query(
      'DELETE FROM call_history WHERE id = $1 AND (caller_id = $2 OR callee_id = $2)',
      [id, req.user.id]
    );
    if (!rowCount) return fail(res, 'Call not found.', 404);
    return ok(res, null, 'Call deleted');
  } catch (error) {
    return next(error);
  }
}

/**
 * Record a call outcome. Called from the socket layer.
 * Direction: caller/callee ids; status completed|missed|declined|cancelled.
 */
async function recordCall({ conversationId, callerId, calleeId, callType, status, durationSeconds }) {
  try {
    await query(
      `INSERT INTO call_history (conversation_id, caller_id, callee_id, call_type, status, started_at, ended_at, duration_seconds)
       VALUES ($1, $2, $3, $4, $5, NOW() - ($6 * INTERVAL '1 second'), NOW(), $6)`,
      [conversationId, callerId, calleeId, callType, status, Math.max(0, Number(durationSeconds || 0))]
    );
  } catch (error) {
    // Never break a live call because history failed.
    console.error('[call_history]', error.message);
  }
}

module.exports = { list, remove, recordCall };
