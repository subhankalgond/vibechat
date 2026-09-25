/**
 * Map a DB user row to the public shape sent to any client.
 * Never include password_hash or email unless explicitly requested.
 */
function publicUser(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    full_name: row.full_name,
    username: row.username,
    profile_image: row.profile_image || null,
    bio: row.bio || null,
    is_online: Boolean(row.is_online),
    last_seen: row.last_seen || null,
  };
}

/**
 * Shape used for the signed-in user (includes email).
 */
function privateUser(row) {
  return { ...publicUser(row), email: row.email };
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
