function notFound(req, res) {
  res.status(404).json({ success: false, message: 'Not found' });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(error, req, res, next) {
  if (error.message === 'UNSUPPORTED_FILE_TYPE') {
    return res.status(415).json({ success: false, message: 'Unsupported file type. Photos: JPG, PNG, WEBP. Videos: MP4, MOV, WEBM.' });
  }
  if (error.type === 'entity.too.large') {
    return res.status(413).json({ success: false, message: 'Request body too large' });
  }
  if (error.code === 'LIMIT_FILE_SIZE') {
    const kind = req.uploadKind === 'video' ? 'Video' : 'Image';
    return res.status(413).json({ success: false, message: `${kind} is too large` });
  }
  if (error.code === '23505') {
    // Postgres unique violation.
    const which = (error.constraint || error.detail || '').includes('email')
      ? 'email'
      : 'username';
    const message = which === 'email' ? 'Email is already registered.' : 'Username already exists.';
    return res.status(409).json({ success: false, message });
  }
  if (error.code && error.code.startsWith('23')) {
    console.error('[db]', error.code, error.detail || error.message);
    return res.status(500).json({ success: false, message: 'Database error. Please try again.' });
  }
  console.error('[error]', error.message);
  return res.status(500).json({ success: false, message: 'Something went wrong' });
}

module.exports = { notFound, errorHandler };
