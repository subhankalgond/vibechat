/**
 * Seeds demo users, a conversation, and sample messages for local development.
 * Usage: npm run seed
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set. Copy the example to server/.env first.');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: url,
    ssl: url.includes('localhost') || url.includes('127.0.0.1') ? false : { rejectUnauthorized: false },
  });

  const { rows: tables } = await pool.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users'"
  );
  if (!tables.length) {
    console.error('Users table not found. Run the schema first (database/schema.sql in the Supabase SQL Editor).');
    await pool.end();
    process.exit(1);
  }

  const demoPassword = await bcrypt.hash('Password123', 10);
  const demoUsers = [
    ['Ayesha Khan', 'ayesha_ds', 'ayesha@example.com', 'Design student. Coffee dependent.'],
    ['Rahul Verma', 'rahul123', 'rahul@example.com', 'Cricket on weekends.'],
    ['Subhan Ali', 'subhan', 'subhan@example.com', 'Building things on the internet.'],
  ];

  const userIds = [];
  for (const [fullName, username, email, bio] of demoUsers) {
    const { rows } = await pool.query(
      `INSERT INTO users (full_name, username, email, password_hash, bio)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (username) DO UPDATE SET full_name = EXCLUDED.full_name, bio = EXCLUDED.bio
       RETURNING id`,
      [fullName, username, email, demoPassword, bio]
    );
    userIds.push(rows[0].id);
  }

  const [userA, userB] = userIds;
  const { rows: existing } = await pool.query(
    `SELECT cm1.conversation_id
       FROM conversation_members cm1
       JOIN conversation_members cm2
         ON cm1.conversation_id = cm2.conversation_id
      WHERE cm1.user_id = $1 AND cm2.user_id = $2`,
    [userA, userB]
  );

  if (!existing.length) {
    const { rows: created } = await pool.query('INSERT INTO conversations DEFAULT VALUES RETURNING id');
    const conversationId = created[0].id;
    await pool.query(
      'INSERT INTO conversation_members (conversation_id, user_id) VALUES ($1, $2), ($1, $3)',
      [conversationId, userA, userB]
    );
    const sample = [
      [userA, userB, 'Hey, what is up?', 3],
      [userB, userA, 'All good here. Finished the project draft.', 2],
      [userA, userB, 'Nice, send it over when you can.', 1],
    ];
    for (const [senderId, receiverId, text, minutesAgo] of sample) {
      await pool.query(
        `INSERT INTO messages (conversation_id, sender_id, receiver_id, message_type, message_text, created_at)
         VALUES ($1, $2, $3, 'text', $4, NOW() - ($5 || ' minutes')::interval)`,
        [conversationId, senderId, receiverId, text, minutesAgo]
      );
    }
  }

  console.log('Seed complete. Demo accounts (development only):');
  for (const username of ['ayesha_ds', 'rahul123', 'subhan']) {
    console.log(`  username: ${username}  password: Password123`);
  }
  await pool.end();
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
