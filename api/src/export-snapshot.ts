// Saves a static snapshot of the dashboard's data, used by the dashboard's "demo mode"
// (a copy of the site that needs no backend). Run: npm run export:demo
// Output goes to ../web/demo-data by default. It reuses the API's own router, so the JSON files
// have exactly the same shape as the live API responses.
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Pool } from 'pg';
import { getPool } from './db';
import { route } from './router';

const OUT = process.argv[2] ?? '../web/demo-data';
const DAYS = 30; // the longest window the dashboard shows; demo mode shows this one window

interface Park { id: string; name: string; timezone: string; attractions: number }
interface Attraction { id: string; name: string; parkId: string | null; status: string | null; currentWait: number | null }
interface BestBody { hours: unknown[] }

async function get<T>(pool: Pool, path: string, query = ''): Promise<T> {
  const result = await route(pool, path, new URLSearchParams(query));
  if (result.status !== 200) throw new Error(`${path} returned HTTP ${result.status}`);
  return result.body as T;
}

const write = (name: string, data: unknown) => writeFile(join(OUT, name), JSON.stringify(data));

async function main(): Promise<void> {
  const pool = getPool();
  await rm(OUT, { recursive: true, force: true });
  await mkdir(join(OUT, 'attractions'), { recursive: true });
  await mkdir(join(OUT, 'rides'), { recursive: true });

  const keptParks: Park[] = [];
  let rideCount = 0;

  for (const park of await get<Park[]>(pool, 'parks')) {
    const kept: Attraction[] = [];
    for (const a of await get<Attraction[]>(pool, 'attractions', `parkId=${park.id}`)) {
      const bestTimes = await get<BestBody>(pool, `attractions/${a.id}/best-times`, `days=${DAYS}`);
      if (bestTimes.hours.length === 0) continue; // never had a posted wait in this window: nothing to show
      const trend = await get<unknown>(pool, `attractions/${a.id}/trend`, `days=${DAYS}`);
      await write(`rides/${a.id}.json`, { bestTimes, trend });
      // "right now" is meaningless in a snapshot, so drop it
      kept.push({ ...a, status: null, currentWait: null });
      rideCount++;
    }
    if (kept.length === 0) continue; // e.g. a park with no readings yet
    await write(`attractions/${park.id}.json`, kept);
    keptParks.push({ ...park, attractions: kept.length });
  }
  await write('parks.json', keptParks);

  const { rows } = await pool.query(
    `SELECT min(captured_at) AS "from", max(captured_at) AS "to", count(*)::int AS readings
       FROM wait_snapshots WHERE captured_at >= now() - ($1::int * interval '1 day')`,
    [DAYS],
  );
  const meta = { generatedAt: new Date().toISOString(), days: DAYS, ...rows[0], rides: rideCount, parks: keptParks.length };
  await write('meta.json', meta);
  console.log(`Exported ${rideCount} rides in ${keptParks.length} parks (${meta.readings} readings) to ${OUT}`);
  await pool.end();
}

main().catch((err) => { console.error(err); process.exitCode = 1; });
