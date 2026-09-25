const { query } = require('../config/db');
const { ok, fail } = require('../utils/serialize');
const { uploadBuffer, destroyAsset, isConfigured } = require('../services/uploadService');
const { IMAGE_MIMES, VIDEO_MIMES } = require('../middleware/upload');

/**
 * POST /api/upload/image  (multipart field: image)
 */
async function uploadImage(req, res, next) {
  try {
    if (!isConfigured()) {
      return fail(res, 'Uploads are not configured. Add Cloudinary keys on the server.', 503);
    }
    if (!req.file) return fail(res, 'No file received.', 422);
    if (!IMAGE_MIMES.has(req.file.mimetype)) {
      return fail(res, 'Unsupported image format. Use JPG, PNG, or WEBP.', 415);
    }
    const result = await uploadBuffer(req.file.buffer, req.file.mimetype, 'vibechat/messages');
    return ok(res, {
      media_url: result.url,
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
    if (!isConfigured()) {
      return fail(res, 'Uploads are not configured. Add Cloudinary keys on the server.', 503);
    }
    if (!req.file) return fail(res, 'No file received.', 422);
    if (!VIDEO_MIMES.has(req.file.mimetype)) {
      return fail(res, 'Unsupported video format. Use MP4, MOV, or WEBM.', 415);
    }
    const result = await uploadBuffer(req.file.buffer, req.file.mimetype, 'vibechat/messages');
    return ok(res, {
      media_url: result.url,
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
 * PUT /api/users/avatar  (multipart field: image)
 * Replaces the signed-in user's profile image.
 */
async function updateAvatar(req, res, next) {
  try {
    if (!isConfigured()) {
      return fail(res, 'Uploads are not configured. Add Cloudinary keys on the server.', 503);
    }
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
      [result.url, result.publicId, req.user.id]
    );
    if (previousPublicId) await destroyAsset(previousPublicId);

    const { privateUser } = require('../utils/serialize');
    return ok(res, { user: privateUser(updated[0]) }, 'Profile picture updated');
  } catch (error) {
    if (error.status) return fail(res, error.message, error.status);
    return next(error);
  }
}

module.exports = { uploadImage, uploadVideo, updateAvatar };
