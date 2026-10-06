import { Pool } from 'pg';

let pool: Pool | undefined;

/**
 * Shared connection pool. Keep DATABASE_URL free of ?sslmode=... —
 * SSL is configured here (Azure Postgres requires it).
 * Set PGSSL_DISABLE=1 for local/CI Postgres.
 * TODO (polish): replace rejectUnauthorized:false by pinning Azure's CA bundle.
 */
export function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error('DATABASE_URL is not set');
    pool = new Pool({
      connectionString,
      max: 3,
      ssl: process.env.PGSSL_DISABLE === '1' ? false : { rejectUnauthorized: false },
    });
  }
  return pool;
}
