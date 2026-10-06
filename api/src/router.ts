import type { Pool } from 'pg';
import { pickBestHours } from './analysis';
import { attractionExists, hourlyStats, listAttractions, listParks, trend } from './queries';

export interface RouteResult { status: number; body: unknown }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (s: string): boolean => UUID.test(s);

/** Read ?days=N, clamped to 1..90. Returns null if it isn't a whole number. */
export function parseDays(raw: string | null, fallback: number): number | null {
  if (raw === null || raw === '') return fallback;
  if (!/^\d+$/.test(raw)) return null;
  return Math.min(90, Math.max(1, Number(raw)));
}

const bad = (message: string): RouteResult => ({ status: 400, body: { error: message } });
const notFound = (message = 'Not found'): RouteResult => ({ status: 404, body: { error: message } });

/**
 * Framework-free router. `path` is relative to /api, e.g. "attractions/<id>/trend".
 * Used by both the Azure Function and the local dev server.
 */
export async function route(pool: Pool, path: string, query: URLSearchParams): Promise<RouteResult> {
  const parts = path.split('/').filter(Boolean);

  if (parts.length === 1 && parts[0] === 'health') return { status: 200, body: { ok: true } };
  if (parts.length === 1 && parts[0] === 'parks') return { status: 200, body: await listParks(pool) };

  if (parts.length === 1 && parts[0] === 'attractions') {
    const parkId = query.get('parkId');
    if (parkId !== null && !isUuid(parkId)) return bad('parkId must be a UUID');
    return { status: 200, body: await listAttractions(pool, parkId) };
  }

  if (parts.length === 3 && parts[0] === 'attractions' && (parts[2] === 'trend' || parts[2] === 'best-times')) {
    const id = parts[1];
    if (!isUuid(id)) return bad('Attraction id must be a UUID');
    const days = parseDays(query.get('days'), parts[2] === 'trend' ? 7 : 14);
    if (days === null) return bad('days must be a whole number');
    if (!(await attractionExists(pool, id))) return notFound('Attraction not found');

    if (parts[2] === 'trend') {
      return { status: 200, body: { attractionId: id, days, points: await trend(pool, id, days) } };
    }
    const hours = await hourlyStats(pool, id, days);
    return { status: 200, body: { attractionId: id, days, ...pickBestHours(hours), hours } };
  }

  return notFound();
}
