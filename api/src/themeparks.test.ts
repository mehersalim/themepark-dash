import { describe, expect, it } from 'vitest';
import { toSnapshots, LiveResponse } from './themeparks';

const PARK = '11111111-1111-1111-1111-111111111111';
const fixture: LiveResponse = {
  id: 'dest',
  name: 'Resort',
  liveData: [
    { id: 'a1', name: 'Ride A', entityType: 'ATTRACTION', parkId: PARK, status: 'OPERATING', queue: { STANDBY: { waitTime: 35 } } },
    { id: 'a2', name: 'Ride B', entityType: 'ATTRACTION', parkId: PARK, status: 'DOWN' },
    { id: 'a3', name: 'Ride C', entityType: 'ATTRACTION', parkId: PARK, status: 'CLOSED' },
    { id: 's1', name: 'Show', entityType: 'SHOW', parkId: PARK, status: 'OPERATING' },
    { id: 'a4', name: 'Ride D', entityType: 'ATTRACTION', parkId: 'unknown', status: 'OPERATING', queue: { STANDBY: { waitTime: null } } },
  ],
};

describe('toSnapshots', () => {
  const rows = toSnapshots(fixture, new Set([PARK]));

  it('keeps only non-closed attractions', () => {
    expect(rows.map((r) => r.attractionId)).toEqual(['a1', 'a2', 'a4']);
  });
  it('reads the standby wait, or null when absent', () => {
    expect(rows[0].standbyWaitMin).toBe(35);
    expect(rows[1].standbyWaitMin).toBeNull();
    expect(rows[2].standbyWaitMin).toBeNull();
  });
  it('nulls park ids that are not in the known set', () => {
    expect(rows[2].parkId).toBeNull();
    expect(rows[0].parkId).toBe(PARK);
  });
});
