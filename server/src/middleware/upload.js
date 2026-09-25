const multer = require('multer');
const env = require('../config/env');

const IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const VIDEO_MIMES = new Set(['video/mp4', 'video/quicktime', 'video/webm']);

function memoryUpload() {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: env.maxVideoMb * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      const isImage = IMAGE_MIMES.has(file.mimetype);
      const isVideo = VIDEO_MIMES.has(file.mimetype);
      if (!isImage && !isVideo) {
        return cb(new Error('UNSUPPORTED_FILE_TYPE'));
      }
      return cb(null, true);
    },
  });
}

/**
 * Attach runtime limits so the error handler knows which cap was exceeded.
 */
function withLimits(kind) {
  return (req, res, next) => {
    req.uploadKind = kind;
    next();
  };
}

module.exports = { memoryUpload, withLimits, IMAGE_MIMES, VIDEO_MIMES };
