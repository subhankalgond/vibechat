const crypto = require('crypto');
const cloudinary = require('../config/cloudinary');
const env = require('../config/env');

const IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const VIDEO_MIMES = new Set(['video/mp4', 'video/quicktime', 'video/webm']);

const EXT_BY_MIME = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
};

function isConfigured() {
  return Boolean(
    env.cloudinary.cloudName && env.cloudinary.apiKey && env.cloudinary.apiSecret
  );
}

/**
 * Upload a buffer to Cloudinary. Returns { url, publicId, mediaType, bytes }.
 */
async function uploadBuffer(buffer, mimetype, folder, originalName) {
  if (!IMAGE_MIMES.has(mimetype) && !VIDEO_MIMES.has(mimetype)) {
    const error = new Error('Unsupported file type');
    error.status = 415;
    throw error;
  }
  const isVideo = VIDEO_MIMES.has(mimetype);
  const maxBytes = (isVideo ? env.maxVideoMb : env.maxImageMb) * 1024 * 1024;
  if (buffer.length > maxBytes) {
    const error = new Error(`${isVideo ? 'Video' : 'Image'} is too large. Max ${isVideo ? env.maxVideoMb : env.maxImageMb} MB.`);
    error.status = 413;
    throw error;
  }

  const ext = EXT_BY_MIME[mimetype] || 'bin';
  const publicId = `${folder}/${Date.now()}_${crypto.randomBytes(6).toString('hex')}.${ext}`;

  const result = await new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        public_id: publicId,
        resource_type: isVideo ? 'video' : 'image',
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
    mediaType: isVideo ? 'video' : 'image',
    format: result.format,
    bytes: result.bytes,
  };
}

async function destroyAsset(publicId) {
  if (!publicId) return;
  const resourceType = publicId.match(/\.(mp4|mov|webm)$/i) || publicId.includes('/video/') ? 'video' : 'image';
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
  } catch (error) {
    console.error('[cloudinary] destroy failed:', error.message);
  }
}

module.exports = { uploadBuffer, destroyAsset, isConfigured, IMAGE_MIMES, VIDEO_MIMES };
