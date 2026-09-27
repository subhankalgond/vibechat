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

  // ------------------------------------------------------------------
  // Expansion migration (idempotent): groups, replies, reactions, edits,
  // disappearing messages, call history, statuses, communities, privacy.
  // ------------------------------------------------------------------

  async function columnExists(table, column) {
    const res = await pool.query(
      'SELECT 1 FROM information_schema.columns WHERE table_name = $1 AND column_name = $2',
      [table, column]
    );
    return res.rowCount > 0;
  }

  async function ensureColumn(table, column, definition) {
    if (!(await columnExists(table, column))) {
      await pool.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
      console.log(`  added column ${table}.${column}`);
    }
  }

  // conversations: group support
  await ensureColumn('conversations', 'type', "TEXT NOT NULL DEFAULT 'direct'");
  await ensureColumn('conversations', 'name', 'TEXT');
  await ensureColumn('conversations', 'avatar_url', 'TEXT');
  await ensureColumn('conversations', 'created_by', 'BIGINT');

  // conversation_members: group roles
  await ensureColumn('conversation_members', 'role', "TEXT NOT NULL DEFAULT 'member'");

  // messages: reply, edit, disappearing
  await ensureColumn('messages', 'reply_to_id', 'BIGINT');
  await ensureColumn('messages', 'edited_at', 'TIMESTAMPTZ');
  await ensureColumn('messages', 'disappears_after_seconds', 'INTEGER');

  // users: privacy
  await ensureColumn('users', 'last_seen_visibility', "TEXT NOT NULL DEFAULT 'everyone'");
  await ensureColumn('users', 'profile_photo_visibility', "TEXT NOT NULL DEFAULT 'everyone'");
  await ensureColumn('users', 'read_receipts_enabled', 'BOOLEAN NOT NULL DEFAULT TRUE');
  await ensureColumn('users', 'password_changed_at', 'TIMESTAMPTZ');

  // message_reactions: one emoji per user per message (toggle by re-insert)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS message_reactions (
      message_id BIGINT REFERENCES messages(id) ON DELETE CASCADE,
      user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
      emoji TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (message_id, user_id)
    );
  `);

  // call_history: audio + video call log
  await pool.query(`
    CREATE TABLE IF NOT EXISTS call_history (
      id BIGSERIAL PRIMARY KEY,
      conversation_id BIGINT REFERENCES conversations(id) ON DELETE CASCADE,
      caller_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
      callee_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
      call_type TEXT NOT NULL CHECK (call_type IN ('audio','video')),
      status TEXT NOT NULL DEFAULT 'missed' CHECK (status IN ('completed','missed','declined','cancelled')),
      started_at TIMESTAMPTZ DEFAULT NOW(),
      ended_at TIMESTAMPTZ,
      duration_seconds INTEGER DEFAULT 0
    );
  `);

  // statuses: 24h stories (text / image / video)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS statuses (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
      status_type TEXT NOT NULL CHECK (status_type IN ('text','image','video')),
      content TEXT,
      background_color TEXT,
      media_url TEXT,
      media_public_id TEXT,
      caption TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours'
    );
  `);

  // status_views: who viewed a status
  await pool.query(`
    CREATE TABLE IF NOT EXISTS status_views (
      status_id BIGINT REFERENCES statuses(id) ON DELETE CASCADE,
      viewer_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
      viewed_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (status_id, viewer_id)
    );
  `);

  // communities + members + events + rsvps
  await pool.query(`
    CREATE TABLE IF NOT EXISTS communities (
      id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      invite_code TEXT UNIQUE NOT NULL,
      created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS community_members (
      community_id BIGINT REFERENCES communities(id) ON DELETE CASCADE,
      user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin','member')),
      joined_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (community_id, user_id)
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS community_events (
      id BIGSERIAL PRIMARY KEY,
      community_id BIGINT REFERENCES communities(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      event_at TIMESTAMPTZ,
      location TEXT,
      created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS community_event_rsvps (
      event_id BIGINT REFERENCES community_events(id) ON DELETE CASCADE,
      user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
      response TEXT NOT NULL DEFAULT 'going' CHECK (response IN ('going','maybe','not_going')),
      PRIMARY KEY (event_id, user_id)
    );
  `);

  // Indexes for the new tables
  await pool.query('CREATE INDEX IF NOT EXISTS idx_messages_reply ON messages (reply_to_id)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_conversations_type ON conversations (type)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_calls_caller ON call_history (caller_id)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_calls_callee ON call_history (callee_id)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_statuses_user ON statuses (user_id, created_at DESC)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_statuses_expiry ON statuses (expires_at)');

  console.log('Expansion ready: groups, reactions, replies, calls, statuses, communities, privacy');
  await pool.end();
}

main().catch((error) => {
  console.error('Setup failed:', error.message);
  process.exit(1);
});
