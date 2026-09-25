const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const int = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const env = {
  // A PORT of 0 or a non-numeric value falls back to 5000 so the server
  // never accidentally binds a random port.
  port: int(process.env.PORT, 5000),
  isProd: process.env.NODE_ENV === 'production',

  databaseUrl: process.env.DATABASE_URL,

  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',

  clientUrls: (process.env.CLIENT_URL || 'http://localhost:5173')
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean),

  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
  },

  maxImageMb: int(process.env.MAX_IMAGE_MB, 10),
  maxVideoMb: int(process.env.MAX_VIDEO_MB, 50),
};

if (!env.databaseUrl || !(env.databaseUrl.startsWith('postgresql://') || env.databaseUrl.startsWith('postgres://'))) {
  console.error('Missing DATABASE_URL. Set it to your Supabase Postgres connection string in server/.env');
  process.exit(1);
}
if (!env.jwtSecret || env.jwtSecret === 'replace_me_with_a_long_random_string') {
  if (env.isProd) {
    console.error('Missing JWT_SECRET. Generate one with: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"');
    process.exit(1);
  }
  env.jwtSecret = 'dev_only_insecure_jwt_secret_change_me';
}

module.exports = env;
