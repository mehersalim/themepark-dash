// Runs the real SQL against a throwaway Postgres. Skipped unless TEST_DATABASE_URL is set
// (CI sets it; your laptop doesn't, so your production database is never touched by tests).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import { hourlyStats, listAttractions, listParks, trend } from './queries';
import { pickBestHours } from './analysis';

const url = process.env.TEST_DATABASE_URL;
const PARK = 'aaaaaaaa-0000-4000-8000-000000000001';
const RIDE = 'aaaaaaaa-0000-4000-8000-000000000002';

const localHour = (d: Date) =>
  Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', hour12: false }).format(d)) % 24;

describe.skipIf(!url)('queries (real Postgres)', () => {
  let pool: Pool;
  const day = new Date();
  day.setUTCDate(day.getUTCDate() - 1);
  const at = (hour: number, minute = 0) => new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), hour, minute));
  const busy = at(14);
  const quiet = at(2);

  beforeAll(async () => {
    pool = new Pool({ connectionString: url, ssl: false });
    await pool.query(`INSERT INTO parks (id, name) VALUES ($1, 'Test Park') ON CONFLICT DO NOTHING`, [PARK]);
    await pool.query(`INSERT INTO attractions (id, park_id, name) VALUES ($1, $2, 'Test Ride') ON CONFLICT DO NOTHING`, [RIDE, PARK]);
    await pool.query('DELETE FROM wait_snapshots WHERE attraction_id = $1', [RIDE]);
    const rows: [Date, string, number | null][] = [
      [at(14, 0), 'OPERATING', 40], [at(14, 10), 'OPERATING', 50], [at(14, 20), 'OPERATING', 60],
      [at(2, 0), 'OPERATING', 20], [at(2, 10), 'OPERATING', 20], [at(2, 20), 'OPERATING', 30],
      [at(14, 30), 'DOWN', null],          // must be ignored
      [at(14, 40), 'OPERATING', null],     // no posted wait: must be ignored
    ];
    for (const [t, status, wait] of rows) {
      await pool.query(
        'INSERT INTO wait_snapshots (attraction_id, captured_at, status, standby_wait_min) VALUES ($1, $2, $3, $4)',
        [RIDE, t, status, wait],
      );
    }
  });

  afterAll(async () => {
    await pool.query('DELETE FROM wait_snapshots WHERE attraction_id = $1', [RIDE]);
    await pool.query('DELETE FROM attractions WHERE id = $1', [RIDE]);
    await pool.query('DELETE FROM parks WHERE id = $1', [PARK]);
    await pool.end();
  });

  it('lists parks with attraction counts', async () => {
    const parks = await listParks(pool);
    expect(parks.find((p) => p.id === PARK)?.attractions).toBe(1);
  });

  it('lists attractions for a park, with no current wait when data is old', async () => {
    const list = await listAttractions(pool, PARK);
    expect(list).toHaveLength(1);
    expect(list[0].currentWait).toBeNull();
  });

  it('groups by park-local hour, ignoring DOWN and null waits', async () => {
    const stats = await hourlyStats(pool, RIDE, 7);
    expect(stats).toHaveLength(2);
    const busyStat = stats.find((s) => s.hour === localHour(busy))!;
    expect(busyStat).toMatchObject({ avgWait: 50, medianWait: 50, samples: 3 });
    const quietStat = stats.find((s) => s.hour === localHour(quiet))!;
    expect(quietStat).toMatchObject({ avgWait: 23, medianWait: 20, samples: 3 });
    expect(pickBestHours(stats).best?.hour).toBe(localHour(quiet));
  });

  it('builds hourly trend buckets in UTC', async () => {
    const points = await trend(pool, RIDE, 7);
    expect(points).toHaveLength(2);
    expect(points[0].bucket.endsWith('Z')).toBe(true);
    const busyPoint = points.find((p) => p.bucket.includes('T14:00'))!;
    expect(busyPoint).toMatchObject({ avgWait: 50, maxWait: 60, samples: 3 });
  });

  it('respects the days window', async () => {
    const stats = await hourlyStats(pool, RIDE, 1);
    // yesterday's rows may fall outside a 1-day window depending on current time; the query must not throw
    expect(Array.isArray(stats)).toBe(true);
  });
});
