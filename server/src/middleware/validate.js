const USERNAME_RE = /^[A-Za-z0-9_]{3,30}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function isNonEmptyString(value, max) {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max;
}

function validateRegister(body) {
  const errors = {};
  const fullName = typeof body.full_name === 'string' ? body.full_name.trim() : '';
  const username = typeof body.username === 'string' ? body.username.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!fullName) errors.full_name = 'Full name is required.';
  else if (fullName.length > 80) errors.full_name = 'Full name is too long.';

  if (!username) errors.username = 'Username is required.';
  else if (!USERNAME_RE.test(username)) {
    errors.username = 'Use 3 to 30 characters: letters, numbers, or underscore.';
  }

  if (!email) errors.email = 'Email is required.';
  else if (!EMAIL_RE.test(email) || email.length > 254) errors.email = 'Enter a valid email address.';

  if (!password) errors.password = 'Password is required.';
  else if (password.length < 8) errors.password = 'Password must contain at least 8 characters.';
  else if (password.length > 128) errors.password = 'Password is too long.';

  if (typeof body.confirm_password === 'string' && body.confirm_password !== password) {
    errors.confirm_password = 'Passwords do not match.';
  }

  return { errors, values: { fullName, username, email, password } };
}

function validateProfileUpdate(body) {
  const errors = {};
  const updates = {};

  if (body.full_name !== undefined) {
    if (!isNonEmptyString(body.full_name, 80)) errors.full_name = 'Full name is required (max 80 chars).';
    else updates.full_name = body.full_name.trim();
  }
  if (body.username !== undefined) {
    const username = typeof body.username === 'string' ? body.username.trim() : '';
    if (!USERNAME_RE.test(username)) errors.username = 'Use 3 to 30 characters: letters, numbers, or underscore.';
    else updates.username = username;
  }
  if (body.bio !== undefined) {
    const bio = typeof body.bio === 'string' ? body.bio.trim() : '';
    if (bio.length > 200) errors.bio = 'Bio must be 200 characters or fewer.';
    else updates.bio = bio || null;
  }
  return { errors, updates };
}

module.exports = { validateRegister, validateProfileUpdate, USERNAME_RE, EMAIL_RE };
