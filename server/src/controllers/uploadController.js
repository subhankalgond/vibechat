const { query } = require('../config/db');
const { ok, fail } = require('../utils/serialize');
const { uploadBuffer, destroyAsset } = require('../services/uploadService');
const { IMAGE_MIMES, VIDEO_MIMES, AUDIO_MIMES } = require('../middleware/upload');

/** Build an absolute URL when storage returned an API-relative path (DB fallback). */
function absoluteUrl(req, url) {
  if (!url || url.startsWith('http')) return url;
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost';
  return `${proto}://${host}${url}`;
}

/**
 * POST /api/upload/image  (multipart field: image)
 */
async function uploadImage(req, res, next) {
  try {
    if (!req.file) return fail(res, 'No file received.', 422);
    if (!IMAGE_MIMES.has(req.file.mimetype)) {
      return fail(res, 'Unsupported image format. Use JPG, PNG, or WEBP.', 415);
    }
    const result = await uploadBuffer(req.file.buffer, req.file.mimetype, 'vibechat/messages');
    return ok(res, {
      media_url: absoluteUrl(req, result.url),
      media_public_id: result.publicId,
      media_type: result.mediaType,
      file_name: req.file.originalname || null,
      file_size: result.bytes,
    }, 'Image uploaded', 201);
  } catch (error) {
    if (error.status) return fail(res, error.message, error.status);
    return next(error);
  }
}

/**
 * POST /api/upload/video  (multipart field: video)
 */
async function uploadVideo(req, res, next) {
  try {
    if (!req.file) return fail(res, 'No file received.', 422);
    if (!VIDEO_MIMES.has(req.file.mimetype)) {
      return fail(res, 'Unsupported video format. Use MP4, MOV, or WEBM.', 415);
    }
    const result = await uploadBuffer(req.file.buffer, req.file.mimetype, 'vibechat/messages');
    return ok(res, {
      media_url: absoluteUrl(req, result.url),
      media_public_id: result.publicId,
      media_type: result.mediaType,
      file_name: req.file.originalname || null,
      file_size: result.bytes,
    }, 'Video uploaded', 201);
  } catch (error) {
    if (error.status) return fail(res, error.message, error.status);
    return next(error);
  }
}

/**
 * POST /api/upload/audio  (multipart field: audio)
 */
async function uploadAudio(req, res, next) {
  try {
    if (!req.file) return fail(res, 'No file received.', 422);
    const mime = String(req.file.mimetype || '').split(';')[0];
    if (!AUDIO_MIMES.has(mime)) {
      return fail(res, 'Unsupported audio format.', 415);
    }
    const result = await uploadBuffer(req.file.buffer, mime, 'vibechat/messages');
    return ok(res, {
      media_url: absoluteUrl(req, result.url),
      media_public_id: result.publicId,
      media_type: 'audio',
      file_name: req.file.originalname || null,
      file_size: result.bytes,
    }, 'Voice note uploaded', 201);
  } catch (error) {
    if (error.status) return fail(res, error.message, error.status);
    return next(error);
  }
}

/**
 * PUT /api/users/avatar  (multipart field: image)
 * Replaces the signed-in user's profile picture.
 */
async function updateAvatar(req, res, next) {
  try {
    if (!req.file) return fail(res, 'No file received.', 422);
    if (!IMAGE_MIMES.has(req.file.mimetype)) {
      return fail(res, 'Unsupported image format. Use JPG, PNG, or WEBP.', 415);
    }

    const { rows } = await query(
      'SELECT profile_image_public_id FROM users WHERE id = $1 LIMIT 1',
      [req.user.id]
    );
    const previousPublicId = rows.length ? rows[0].profile_image_public_id : null;

    const result = await uploadBuffer(req.file.buffer, req.file.mimetype, 'vibechat/avatars');
    const { rows: updated } = await query(
      `UPDATE users
          SET profile_image = $1, profile_image_public_id = $2
        WHERE id = $3
        RETURNING *`,
      [absoluteUrl(req, result.url), result.publicId, req.user.id]
    );
    if (previousPublicId) await destroyAsset(previousPublicId);

    const { privateUser } = require('../utils/serialize');
    return ok(res, { user: privateUser(updated[0]) }, 'Profile picture updated');
  } catch (error) {
    if (error.status) return fail(res, error.message, error.status);
    return next(error);
  }
}

module.exports = { uploadImage, uploadVideo, uploadAudio, updateAvatar };
