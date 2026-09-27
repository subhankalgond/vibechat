/**
 * Map a DB user row to the public shape sent to any client.
 * Never include password_hash or email unless explicitly requested.
 * Privacy: hides last_seen and profile_image per the row owner's settings.
 */
function publicUser(row) {
  if (!row) return null;
  const hidePhoto =
    (row.profile_photo_visibility || 'everyone') === 'nobody';
  return {
    id: Number(row.id),
    full_name: row.full_name,
    username: row.username,
    profile_image: hidePhoto ? null : row.profile_image || null,
    bio: row.bio || null,
    is_online: (row.last_seen_visibility || 'everyone') === 'nobody' ? false : Boolean(row.is_online),
    last_seen: (row.last_seen_visibility || 'everyone') === 'everyone' ? row.last_seen || null : null,
  };
}

/**
 * Shape used for the signed-in user (includes email + own privacy settings).
 */
function privateUser(row) {
  return {
    ...publicUser(row),
    email: row.email,
    last_seen_visibility: row.last_seen_visibility || 'everyone',
    profile_photo_visibility: row.profile_photo_visibility || 'everyone',
    read_receipts_enabled: row.read_receipts_enabled !== false,
  };
}

function ok(res, data = null, message = 'OK', status = 200) {
  return res.status(status).json({ success: true, message, data });
}

function fail(res, message = 'Something went wrong', status = 400, errors) {
  const body = { success: false, message };
  if (errors) body.errors = errors;
  return res.status(status).json(body);
}

module.exports = { publicUser, privateUser, ok, fail };
