import type { Pool } from 'pg';
import { fetchDestinations, fetchLive, toSnapshots } from './themeparks';

export async function runIngestion(pool: Pool, destinationId: string): Promise<{ inserted: number }> {
  const dest = (await fetchDestinations()).find((d) => d.id === destinationId);
  if (!dest) throw new Error(`Destination ${destinationId} not found in /v1/destinations`);

  const live = await fetchLive(destinationId);
  const parkIds = dest.parks.map((p) => p.id);
  const rows = toSnapshots(live, new Set(parkIds));

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO parks (id, name)
       SELECT * FROM unnest($1::uuid[], $2::text[])
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
      [parkIds, dest.parks.map((p) => p.name)],
    );
    if (rows.length > 0) {
      await client.query(
        `INSERT INTO attractions (id, park_id, name)
         SELECT * FROM unnest($1::uuid[], $2::uuid[], $3::text[])
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, park_id = EXCLUDED.park_id`,
        [rows.map((r) => r.attractionId), rows.map((r) => r.parkId), rows.map((r) => r.name)],
      );
      await client.query(
        `INSERT INTO wait_snapshots (attraction_id, status, standby_wait_min)
         SELECT * FROM unnest($1::uuid[], $2::text[], $3::int[])`,
        [rows.map((r) => r.attractionId), rows.map((r) => r.status), rows.map((r) => r.standbyWaitMin)],
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  return { inserted: rows.length };
}
