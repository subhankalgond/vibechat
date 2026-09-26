const { pool } = require('../src/config/db');

async function main() {
  console.log('Setting up database...');

  // users
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGSERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      full_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      profile_image TEXT,
      profile_image_public_id TEXT,
      about TEXT,
      is_online BOOLEAN DEFAULT FALSE,
      last_seen TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // conversations
  await pool.query(`
    CREATE TABLE IF NOT EXISTS conversations (
      id BIGSERIAL PRIMARY KEY,
      created_at TIMESTAMPTZ DEFAULT NOW()
   );
  `);

  // conversation_members
  await coreMemberTable();

  async function coreMemberTable() {
    const existing = await pool.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name='conversation_members'"
    );
    const cols = new Set(existing.rows.map((r) => r.column_name));
    if (cols.size === 0) {
      await pool.query(`
        CREATE TABLE conversation_members (
          conversation_id BIGINT REFERENCES conversations(id) ON DELETE CASCADE,
          user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
          joined_at TIMESTAMPTZ DEFAULT NOW(),
          last_read_at TIMESTAMPTZ,
          PRIMARY KEY (conversation_id, user_id)
        );
      `);
      return;
    }
    if (cols.has('last_read_at')) return;

    // Legacy MySQL-era schema: migrate to the current shape.
    await pool.query('ALTER TABLE conversation_members RENAME TO conversation_members_old');
    await pool.query(`
      CREATE TABLE conversation_members (
        conversation_id BIGINT REFERENCES conversations(id) ON DELETE CASCADE,
        user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
        joined_at TIMESTAMPTZ DEFAULT NOW(),
        last_read_at TIMESTAMPTZ,
        PRIMARY KEY (conversation_id, user_id)
      );
    `);
    await pool.query('INSERT INTO conversation_members SELECT conversation_id, user_id, COALESCE(joined_at, NOW()), last_read_at FROM conversation_members_old');
    await pool.query('DROP TABLE conversation_members_old');
  }

  // messages
  await pool.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id BIGSERIAL PRIMARY KEY,
      conversation_id BIGINT REFERENCES conversations(id) ON DELETE CASCADE,
      sender_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
      message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text','image','video','audio')),
      message_text TEXT,
      media_url TEXT,
      media_public_id TEXT,
      file_name TEXT,
      file_size BIGINT,
      media_width INTEGER,
      media_height INTEGER,
      duration_seconds INTEGER,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      delivered_at TIMESTAMPTZ,
      seen_at TIMESTAMPTZ,
      deleted_at TIMESTAMPTZ
    );
  `);

  // message_deletions
  await pool.query(`
    CREATE TABLE IF NOT EXISTS message_deletions (
      message_id BIGINT REFERENCES messages(id) ON DELETE CASCADE,
      user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
      deleted_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (message_id, user_id)
    );
  `);

  // media_files: server-side storage fallback used when Cloudinary is not
  // configured. Voice notes / photos / videos are kept as bytea and served
  // from /api/media/:id so media works with zero external keys.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS media_files (
      id TEXT PRIMARY KEY,
      data BYTEA NOT NULL,
      media_type TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      file_name TEXT,
      byte_size BIGINT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // Indexes
  await pool.query('CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON messages (conversation_id, created_at DESC)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_members_user ON conversation_members (user_id)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_messages_seen_pending ON messages (conversation_id) WHERE seen_at IS NULL');

  console.log('Tables ready: conversation_members, conversations, media_files, message_deletions, messages, users');
  await pool.end();
}

main().catch((error) => {
  console.error('Setup failed:', error.message);
  process.exit(1);
});
