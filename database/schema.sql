-- VibeChat schema for PostgreSQL (Supabase)
--
-- Supabase: open the SQL Editor and paste this whole file, then Run.
-- Local psql: psql "your-connection-string" -f database/schema.sql

CREATE TABLE IF NOT EXISTS users (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  full_name      VARCHAR(80)  NOT NULL,
  username       VARCHAR(30)  NOT NULL,
  email          VARCHAR(254) NOT NULL,
  password_hash  VARCHAR(255) NOT NULL,
  profile_image  VARCHAR(500)     NULL,
  profile_image_public_id VARCHAR(255) NULL,
  bio            VARCHAR(200)     NULL,
  is_online      BOOLEAN      NOT NULL DEFAULT FALSE,
  last_seen      TIMESTAMPTZ      NULL,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT users_username_key UNIQUE (username),
  CONSTRAINT users_email_key UNIQUE (email)
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users (username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);

CREATE TABLE IF NOT EXISTS conversations (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS conversation_members (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  conversation_id BIGINT NOT NULL REFERENCES conversations (id) ON DELETE CASCADE,
  user_id         BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  last_read_at    TIMESTAMPTZ NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT conversation_members_unique UNIQUE (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_conversation_members_user ON conversation_members (user_id);

CREATE TABLE IF NOT EXISTS message_deletions (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  message_id BIGINT NOT NULL REFERENCES messages (id) ON DELETE CASCADE,
  user_id    BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT message_deletions_unique UNIQUE (message_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_message_deletions_user ON message_deletions (user_id);

CREATE TABLE IF NOT EXISTS messages (
  id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  conversation_id  BIGINT NOT NULL REFERENCES conversations (id) ON DELETE CASCADE,
  sender_id        BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  receiver_id      BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  message_type     VARCHAR(10) NOT NULL DEFAULT 'text'
                   CONSTRAINT messages_type_check CHECK (message_type IN ('text', 'image', 'video')),
  message_text     TEXT NULL,
  media_url        VARCHAR(600) NULL,
  media_public_id  VARCHAR(255) NULL,
  media_type       VARCHAR(40)  NULL,
  file_name        VARCHAR(255) NULL,
  file_size        BIGINT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered_at     TIMESTAMPTZ NULL,
  seen_at          TIMESTAMPTZ NULL,
  CONSTRAINT messages_receiver_check CHECK (receiver_id <> sender_id)
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON messages (conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages (sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages (receiver_id);
