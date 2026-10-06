import { describe, expect, it, vi } from 'vitest';
import type { Pool } from 'pg';
import { isUuid, parseDays, route } from './router';

const ID = '11111111-1111-1111-1111-111111111111';

/** A fake pool that answers based on which table the SQL mentions. */
function fakePool(opts: { attractionExists?: boolean } = {}) {
  const query = vi.fn(async (sql: string) => {
    if (sql.includes('SELECT 1 FROM attractions')) return { rows: [], rowCount: opts.attractionExists === false ? 0 : 1 };
    if (sql.includes('FROM parks p')) return { rows: [{ id: ID, name: 'Magic Kingdom Park', timezone: 'America/New_York', attractions: 2 }] };
    if (sql.includes('FROM attractions a')) return { rows: [{ id: ID, name: 'Ride', parkId: null, status: null, currentWait: null }] };
    if (sql.includes('percentile_cont')) {
      return { rows: [
        { hour: 9, avgWait: 30, medianWait: 30, samples: 10 },
        { hour: 14, avgWait: 70, medianWait: 70, samples: 10 },
      ] };
    }
    return { rows: [{ bucket: '2026-10-05T14:00:00Z', avgWait: 50, maxWait: 60, samples: 6 }] };
  });
  return { pool: { query } as unknown as Pool, query };
}

describe('helpers', () => {
  it('isUuid accepts UUIDs and rejects junk', () => {
    expect(isUuid(ID)).toBe(true);
    expect(isUuid('not-a-uuid')).toBe(false);
    expect(isUuid("1'; DROP TABLE parks;--")).toBe(false);
  });
  it('parseDays defaults, clamps, and rejects non-numbers', () => {
    expect(parseDays(null, 7)).toBe(7);
    expect(parseDays('30', 7)).toBe(30);
    expect(parseDays('0', 7)).toBe(1);
    expect(parseDays('999', 7)).toBe(90);
    expect(parseDays('abc', 7)).toBeNull();
    expect(parseDays('-5', 7)).toBeNull();
  });
});

describe('route', () => {
  it('health', async () => {
    const r = await route(fakePool().pool, 'health', new URLSearchParams());
    expect(r).toEqual({ status: 200, body: { ok: true } });
  });

  it('parks', async () => {
    const r = await route(fakePool().pool, 'parks', new URLSearchParams());
    expect(r.status).toBe(200);
    expect(r.body).toHaveLength(1);
  });

  it('attractions rejects a bad parkId without touching the database', async () => {
    const { pool, query } = fakePool();
    const r = await route(pool, 'attractions', new URLSearchParams('parkId=oops'));
    expect(r.status).toBe(400);
    expect(query).not.toHaveBeenCalled();
  });

  it('best-times returns best and worst hours', async () => {
    const r = await route(fakePool().pool, `attractions/${ID}/best-times`, new URLSearchParams());
    expect(r.status).toBe(200);
    const body = r.body as { best: { hour: number }; worst: { hour: number }; days: number };
    expect(body.best.hour).toBe(9);
    expect(body.worst.hour).toBe(14);
    expect(body.days).toBe(14);
  });

  it('trend defaults to 7 days and passes parameters, not string-built SQL', async () => {
    const { pool, query } = fakePool();
    const r = await route(pool, `attractions/${ID}/trend`, new URLSearchParams());
    expect(r.status).toBe(200);
    expect((r.body as { days: number }).days).toBe(7);
    const lastCall = query.mock.calls.at(-1) as unknown as [string, unknown[]];
    expect(lastCall[1]).toEqual([ID, 7]);
  });

  it('400 for a bad id or bad days', async () => {
    const { pool } = fakePool();
    expect((await route(pool, 'attractions/xyz/trend', new URLSearchParams())).status).toBe(400);
    expect((await route(pool, `attractions/${ID}/trend`, new URLSearchParams('days=abc'))).status).toBe(400);
  });

  it('404 for an unknown attraction or unknown path', async () => {
    expect((await route(fakePool({ attractionExists: false }).pool, `attractions/${ID}/trend`, new URLSearchParams())).status).toBe(404);
    expect((await route(fakePool().pool, 'nope', new URLSearchParams())).status).toBe(404);
  });
});
