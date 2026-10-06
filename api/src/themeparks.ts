const BASE = 'https://api.themeparks.wiki/v1';

export interface LiveEntry {
  id: string;
  name: string;
  entityType: string;
  parkId?: string;
  status?: string;
  queue?: { STANDBY?: { waitTime: number | null } };
}
export interface LiveResponse { id: string; name: string; liveData: LiveEntry[] }
export interface Destination {
  id: string;
  name: string;
  slug: string;
  parks: { id: string; name: string }[];
}
export interface Snapshot {
  attractionId: string;
  parkId: string | null;
  name: string;
  status: string;
  standbyWaitMin: number | null;
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'themepark-dash (portfolio project)' },
  });
  if (!res.ok) throw new Error(`ThemeParks.wiki ${path} -> HTTP ${res.status}`);
  return (await res.json()) as T;
}

export async function fetchDestinations(): Promise<Destination[]> {
  return (await getJson<{ destinations: Destination[] }>('/destinations')).destinations;
}

export function fetchLive(entityId: string): Promise<LiveResponse> {
  return getJson<LiveResponse>(`/entity/${entityId}/live`);
}

/** Pure function: keep attractions that are not CLOSED, flatten to DB-ready rows. */
export function toSnapshots(live: LiveResponse, knownParkIds: Set<string>): Snapshot[] {
  return live.liveData
    .filter((e) => e.entityType === 'ATTRACTION' && e.status && e.status !== 'CLOSED')
    .map((e) => ({
      attractionId: e.id,
      parkId: e.parkId && knownParkIds.has(e.parkId) ? e.parkId : null,
      name: e.name,
      status: e.status as string,
      standbyWaitMin: e.queue?.STANDBY?.waitTime ?? null,
    }));
}
