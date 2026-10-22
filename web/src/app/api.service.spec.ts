import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ApiService } from './api.service';
import { API_BASE } from './config';
import { IS_DEMO } from './demo';

function setup(demo: boolean) {
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting(), { provide: IS_DEMO, useValue: demo }],
  });
  return { api: TestBed.inject(ApiService), http: TestBed.inject(HttpTestingController) };
}

describe('ApiService', () => {
  it('calls the live API when not in demo mode', async () => {
    const { api, http } = setup(false);
    const result = api.bestTimes('ride-1', 7);
    http.expectOne(`${API_BASE}/attractions/ride-1/best-times?days=7`).flush({ hours: [] });
    expect(await result).toEqual({ hours: [] } as never);
    expect(await Promise.resolve(api.meta())).toBeNull();
    http.verify();
  });

  it('reads saved files in demo mode, with one request per ride', async () => {
    const { api, http } = setup(true);
    const bestTimes = api.bestTimes('ride-1', 7);
    const trend = api.trend('ride-1', 7); // same ride: must reuse the same file
    http.expectOne('demo-data/rides/ride-1.json').flush({ bestTimes: { hours: [1] }, trend: { points: [2] } });
    expect(await bestTimes).toEqual({ hours: [1] } as never);
    expect(await trend).toEqual({ points: [2] } as never);
    http.verify();
  });

  it('uses per-park attraction files and a parks file in demo mode', async () => {
    const { api, http } = setup(true);
    const parks = api.parks();
    http.expectOne('demo-data/parks.json').flush([]);
    await parks;
    const rides = api.attractions('park-1');
    http.expectOne('demo-data/attractions/park-1.json').flush([]);
    await rides;
    http.verify();
  });

  it('retries a ride file after a failed load instead of caching the failure', async () => {
    const { api, http } = setup(true);
    const first = api.bestTimes('ride-1', 7).catch(() => 'failed');
    http.expectOne('demo-data/rides/ride-1.json').flush('x', { status: 404, statusText: 'Not Found' });
    expect(await first).toBe('failed');
    const second = api.bestTimes('ride-1', 7);
    http.expectOne('demo-data/rides/ride-1.json').flush({ bestTimes: { hours: [] }, trend: { points: [] } });
    expect(await second).toEqual({ hours: [] } as never);
  });
});
