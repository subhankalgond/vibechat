const { Pool } = require('pg');
const env = require('./env');

const isLocal =
  env.databaseUrl.includes('localhost') || env.databaseUrl.includes('127.0.0.1');

const pool = new Pool({
  connectionString: env.databaseUrl,
  max: 5,
  // Supabase requires TLS; local Postgres does not.
  ssl: isLocal ? false : { rejectUnauthorized: false },
});

/**
 * Run a parameterized query. Resolves to { rows }.
 * Placeholders are $1, $2, ... (PostgreSQL style).
 */
function query(sql, params = []) {
  return pool.query(sql, params);
}

/**
 * Run statements inside a transaction. fn receives a client and must use
 * the $n placeholder style. Commits on success, rolls back on error.
 */
async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { pool, query, withTransaction };
