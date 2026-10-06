import type { Pool } from 'pg';
import type { HourStat } from './analysis';

export interface ParkRow { id: string; name: string; timezone: string; attractions: number }
export interface AttractionRow {
  id: string;
  name: string;
  parkId: string | null;
  status: string | null;       // latest status, only if reported in the last 30 minutes
  currentWait: number | null;  // latest standby wait, only if reported in the last 30 minutes
}
export interface TrendPoint { bucket: string; avgWait: number; maxWait: number; samples: number }

export async function listParks(pool: Pool): Promise<ParkRow[]> {
  const { rows } = await pool.query(
    `SELECT p.id, p.name, p.timezone, COUNT(a.id)::int AS attractions
       FROM parks p LEFT JOIN attractions a ON a.park_id = p.id
      GROUP BY p.id ORDER BY p.name`,
  );
  return rows;
}

export async function listAttractions(pool: Pool, parkId: string | null): Promise<AttractionRow[]> {
  const { rows } = await pool.query(
    `SELECT a.id, a.name, a.park_id AS "parkId",
            CASE WHEN l.captured_at > now() - interval '30 minutes' THEN l.status END AS status,
            CASE WHEN l.captured_at > now() - interval '30 minutes' THEN l.standby_wait_min END AS "currentWait"
       FROM attractions a
       LEFT JOIN LATERAL (
         SELECT status, standby_wait_min, captured_at
           FROM wait_snapshots WHERE attraction_id = a.id
          ORDER BY captured_at DESC LIMIT 1
       ) l ON true
      WHERE ($1::uuid IS NULL OR a.park_id = $1::uuid)
      ORDER BY a.name`,
    [parkId],
  );
  return rows;
}

export async function attractionExists(pool: Pool, id: string): Promise<boolean> {
  const { rowCount } = await pool.query('SELECT 1 FROM attractions WHERE id = $1', [id]);
  return (rowCount ?? 0) > 0;
}

/** Average and median wait by hour of day, in the park's local time. */
export async function hourlyStats(pool: Pool, attractionId: string, days: number): Promise<HourStat[]> {
  const { rows } = await pool.query(
    `SELECT EXTRACT(HOUR FROM s.captured_at AT TIME ZONE COALESCE(p.timezone, 'America/New_York'))::int AS hour,
            ROUND(AVG(s.standby_wait_min))::int AS "avgWait",
            percentile_cont(0.5) WITHIN GROUP (ORDER BY s.standby_wait_min)::float AS "medianWait",
            COUNT(*)::int AS samples
       FROM wait_snapshots s
       JOIN attractions a ON a.id = s.attraction_id
       LEFT JOIN parks p ON p.id = a.park_id
      WHERE s.attraction_id = $1
        AND s.status = 'OPERATING'
        AND s.standby_wait_min IS NOT NULL
        AND s.captured_at >= now() - ($2::int * interval '1 day')
      GROUP BY 1 ORDER BY 1`,
    [attractionId, days],
  );
  return rows;
}

/** Hourly average/max wait over the last N days (UTC hour buckets). */
export async function trend(pool: Pool, attractionId: string, days: number): Promise<TrendPoint[]> {
  const { rows } = await pool.query(
    `SELECT to_char(date_trunc('hour', s.captured_at) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS bucket,
            ROUND(AVG(s.standby_wait_min))::int AS "avgWait",
            MAX(s.standby_wait_min)::int AS "maxWait",
            COUNT(*)::int AS samples
       FROM wait_snapshots s
      WHERE s.attraction_id = $1
        AND s.status = 'OPERATING'
        AND s.standby_wait_min IS NOT NULL
        AND s.captured_at >= now() - ($2::int * interval '1 day')
      GROUP BY date_trunc('hour', s.captured_at)
      ORDER BY date_trunc('hour', s.captured_at)`,
    [attractionId, days],
  );
  return rows;
}
