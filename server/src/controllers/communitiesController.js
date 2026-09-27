const { query } = require('../config/db');
const { ok, fail } = require('../utils/serialize');
const { makeInviteCode } = require('../services/conversationService');

/**
 * GET /api/communities — mine + discoverable via invite code.
 */
async function list(req, res, next) {
  try {
    const userId = Number(req.user.id);
    const { rows } = await query(
      `SELECT c.id, c.name, c.description, c.invite_code, c.created_by, c.created_at,
              (SELECT COUNT(*) FROM community_members m WHERE m.community_id = c.id)::int AS member_count,
              (SELECT m.role FROM community_members m WHERE m.community_id = c.id AND m.user_id = $1 LIMIT 1) AS my_role
         FROM communities c
         JOIN community_members m2 ON m2.community_id = c.id AND m2.user_id = $1
        ORDER BY c.created_at DESC`,
      [userId]
    );
    const communities = [];
    for (const row of rows) {
      communities.push({
        id: Number(row.id),
        name: row.name,
        description: row.description || null,
        invite_code: row.invite_code,
        member_count: Number(row.member_count || 0),
        my_role: row.my_role || null,
        created_at: row.created_at,
        events: await listEvents(row.id),
      });
    }
    return ok(res, { communities });
  } catch (error) {
    return next(error);
  }
}

async function listEvents(communityId) {
  const { rows } = await query(
    `SELECT e.id, e.title, e.description, e.event_at, e.location,
            (SELECT COUNT(*) FROM community_event_rsvps r WHERE r.event_id = e.id AND r.response = 'going')::int AS going_count,
            (SELECT r.response FROM community_event_rsvps r WHERE r.event_id = e.id AND r.user_id = 0 LIMIT 1) AS _unused
       FROM community_events e
      WHERE e.community_id = $1
      ORDER BY e.event_at ASC NULLS LAST, e.created_at DESC
      LIMIT 50`,
    [communityId]
  );
  return rows.map((r) => ({
    id: Number(r.id),
    title: r.title,
    description: r.description || null,
    event_at: r.event_at,
    location: r.location || null,
    going_count: Number(r.going_count || 0),
  }));
}

/**
 * POST /api/communities { name, description? } — creator becomes admin.
 */
async function create(req, res, next) {
  try {
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    if (!name || name.length > 80) return fail(res, 'Community name is required (max 80 chars).', 422);
    const description = typeof req.body.description === 'string' ? req.body.description.trim().slice(0, 500) || null : null;

    const { rows } = await query(
      'INSERT INTO communities (name, description, invite_code, created_by) VALUES ($1, $2, $3, $4) RETURNING id, invite_code',
      [name, description, makeInviteCode(), req.user.id]
    );
    await query(
      `INSERT INTO community_members (community_id, user_id, role) VALUES ($1, $2, 'admin') ON CONFLICT DO NOTHING`,
      [rows[0].id, req.user.id]
    );
    return ok(res, { id: Number(rows[0].id), invite_code: rows[0].invite_code }, 'Community created', 201);
  } catch (error) {
    return next(error);
  }
}

/**
 * POST /api/communities/join { invite_code } — join by code.
 */
async function join(req, res, next) {
  try {
    const code = typeof req.body.invite_code === 'string' ? req.body.invite_code.trim().toLowerCase() : '';
    if (!code) return fail(res, 'Invite code is required.', 422);
    const { rows } = await query('SELECT id, name FROM communities WHERE invite_code = $1 LIMIT 1', [code]);
    if (!rows.length) return fail(res, 'Invalid invite code.', 404);
    await query(
      `INSERT INTO community_members (community_id, user_id, role) VALUES ($1, $2, 'member') ON CONFLICT DO NOTHING`,
      [rows[0].id, req.user.id]
    );
    return ok(res, { id: Number(rows[0].id), name: rows[0].name }, 'Joined community');
  } catch (error) {
    return next(error);
  }
}

/**
 * DELETE /api/communities/:id — leave (or delete if admin/creator).
 */
async function remove(req, res, next) {
  try {
    const id = Number(req.params.id);
    const { rows } = await query(
      'SELECT role FROM community_members WHERE community_id = $1 AND user_id = $2 LIMIT 1',
      [id, req.user.id]
    );
    if (!rows.length) return fail(res, 'Community not found.', 404);
    if (rows[0].role === 'admin') {
      await query('DELETE FROM communities WHERE id = $1', [id]);
      return ok(res, null, 'Community deleted');
    }
    await query('DELETE FROM community_members WHERE community_id = $1 AND user_id = $2', [id, req.user.id]);
    return ok(res, null, 'You left the community');
  } catch (error) {
    return next(error);
  }
}

/**
 * POST /api/communities/:id/events { title, description?, event_at?, location? }
 */
async function createEvent(req, res, next) {
  try {
    const communityId = Number(req.params.id);
    const { rows: member } = await query(
      'SELECT 1 FROM community_members WHERE community_id = $1 AND user_id = $2 LIMIT 1',
      [communityId, req.user.id]
    );
    if (!member.length) return fail(res, 'Community not found.', 404);

    const title = typeof req.body.title === 'string' ? req.body.title.trim() : '';
    if (!title || title.length > 120) return fail(res, 'Event title is required (max 120 chars).', 422);
    const description = typeof req.body.description === 'string' ? req.body.description.trim().slice(0, 1000) || null : null;
    const location = typeof req.body.location === 'string' ? req.body.location.trim().slice(0, 200) || null : null;
    let eventAt = null;
    if (req.body.event_at) {
      const date = new Date(req.body.event_at);
      if (Number.isNaN(date.getTime())) return fail(res, 'Invalid event date.', 422);
      eventAt = date.toISOString();
    }

    const { rows } = await query(
      `INSERT INTO community_events (community_id, title, description, event_at, location, created_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [communityId, title, description, eventAt, location, req.user.id]
    );
    return ok(res, { id: Number(rows[0].id) }, 'Event created', 201);
  } catch (error) {
    return next(error);
  }
}

/**
 * POST /api/communities/events/:eventId/rsvp { response: going|maybe|not_going }
 */
async function rsvp(req, res, next) {
  try {
    const eventId = Number(req.params.eventId);
    const response = req.body.response;
    if (!['going', 'maybe', 'not_going'].includes(response)) return fail(res, 'Invalid RSVP.', 422);

    const { rows } = await query(
      `SELECT e.community_id FROM community_events e
         JOIN community_members m ON m.community_id = e.community_id AND m.user_id = $2
        WHERE e.id = $1 LIMIT 1`,
      [eventId, req.user.id]
    );
    if (!rows.length) return fail(res, 'Event not found.', 404);

    if (response === 'not_going') {
      await query('DELETE FROM community_event_rsvps WHERE event_id = $1 AND user_id = $2', [eventId, req.user.id]);
    } else {
      await query(
        `INSERT INTO community_event_rsvps (event_id, user_id, response) VALUES ($1, $2, $3)
         ON CONFLICT (event_id, user_id) DO UPDATE SET response = EXCLUDED.response`,
        [eventId, req.user.id, response]
      );
    }
    return ok(res, null, 'RSVP saved');
  } catch (error) {
    return next(error);
  }
}

module.exports = { list, create, join, remove, createEvent, rsvp };
