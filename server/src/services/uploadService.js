const crypto = require('crypto');
const { query } = require('../config/db');
const cloudinary = require('../config/cloudinary');
const env = require('../config/env');

const IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const VIDEO_MIMES = new Set(['video/mp4', 'video/quicktime', 'video/webm']);
const AUDIO_MIMES = new Set(['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/ogg', 'audio/aac', 'audio/wav', 'audio/x-m4a']);

const EXT_BY_MIME = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
  'audio/webm': 'webm',
  'audio/mp4': 'm4a',
  'audio/mp4;codecs=opus': 'm4a',
  'audio/mpeg': 'mp3',
  'audio/ogg': 'ogg',
  'audio/aac': 'aac',
  'audio/wav': 'wav',
  'audio/x-m4a': 'm4a',
};

function isConfigured() {
  return Boolean(
    env.cloudinary.cloudName && env.cloudinary.apiKey && env.cloudinary.apiSecret
  );
}

/**
 * Store media in the database (bytea) and return a URL served by the API.
 * Used when Cloudinary keys are not configured, so photo/video/voice
 * messages work with zero external services.
 */
async function uploadBufferToDb(buffer, mimetype, originalName) {
  const id = `${Date.now().toString(36)}_${crypto.randomBytes(12).toString('hex')}`;
  await query(
    `INSERT INTO media_files (id, data, media_type, mime_type, file_name, byte_size)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, buffer, mimetype.split('/')[0], mimetype, originalName || null, buffer.length]
  );
  return {
    url: `/api/media/${id}`,
    publicId: null,
    mediaType: mimetype.startsWith('video/') ? 'video' : mimetype.startsWith('audio/') ? 'audio' : 'image',
    format: (EXT_BY_MIME[mimetype] || 'bin').replace('.', ''),
    bytes: buffer.length,
  };
}

/**
 * Upload a buffer. Prefers Cloudinary when configured; falls back to the
 * database automatically. Returns { url, publicId, mediaType, bytes }.
 */
async function uploadBuffer(buffer, mimetype, folder, originalName) {
  if (!IMAGE_MIMES.has(mimetype) && !VIDEO_MIMES.has(mimetype) && !AUDIO_MIMES.has(mimetype)) {
    const error = new Error('Unsupported file type');
    error.status = 415;
    throw error;
  }
  const isVideo = VIDEO_MIMES.has(mimetype);
  const isAudio = AUDIO_MIMES.has(mimetype);
  // Voice notes use the (small) image cap; full videos keep the video cap.
  const maxBytes = (isVideo ? env.maxVideoMb : env.maxImageMb) * 1024 * 1024;
  if (buffer.length > maxBytes) {
    const error = new Error(`${isVideo ? 'Video' : 'Audio'} is too large. Max ${isVideo ? env.maxVideoMb : env.maxImageMb} MB.`);
    error.status = 413;
    throw error;
  }

  if (!isConfigured()) {
    return uploadBufferToDb(buffer, mimetype, originalName);
  }

  const ext = EXT_BY_MIME[mimetype] || 'bin';
  const publicId = `${folder}/${Date.now()}_${crypto.randomBytes(6).toString('hex')}.${ext}`;

  const result = await new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        public_id: publicId,
        resource_type: isVideo ? 'video' : 'auto',
        folder,
        overwrite: false,
      },
      (err, uploaded) => (err ? reject(err) : resolve(uploaded))
    );
    stream.end(buffer);
  });

  return {
    url: result.secure_url,
    publicId: result.public_id,
    mediaType: isVideo ? 'video' : isAudio ? 'audio' : 'image',
    format: result.format,
    bytes: result.bytes,
  };
}

/**
 * Fetch a stored media file from the database fallback. Returns
 * { data, mimeType, fileName } or null when the id is unknown.
 */
async function getDbMedia(id) {
  const result = await query(
    'SELECT data, mime_type, file_name FROM media_files WHERE id = $1',
    [id]
  );
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return { data: row.data, mimeType: row.mime_type, fileName: row.file_name };
}

async function destroyAsset(publicId) {
  if (!publicId) return;
  const resourceType = publicId.match(/\.(mp4|mov|webm)$/i) || publicId.includes('/video/') ? 'video' : 'image';
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
  } catch {
    // Deleting is best-effort; never block message deletion on it.
  }
}

module.exports = {
  isConfigured,
  uploadBuffer,
  uploadBufferToDb,
  getDbMedia,
  destroyAsset,
  IMAGE_MIMES,
  VIDEO_MIMES,
  AUDIO_MIMES,
};
