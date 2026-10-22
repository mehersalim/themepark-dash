import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE } from './config';
import { IS_DEMO } from './demo';
import { Attraction, BestTimes, DemoMeta, Park, RideFile, Trend } from './models';

/**
 * Talks to the live API, or (in the demo build) reads saved JSON files from /demo-data.
 * The rest of the app doesn't know the difference.
 */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly demo = inject(IS_DEMO);
  private readonly rideFiles = new Map<string, Promise<RideFile>>();

  private get<T>(url: string): Promise<T> {
    return firstValueFrom(this.http.get<T>(url));
  }

  /** In demo mode best-times and trend live in one file per ride; fetch it once and reuse it. */
  private ride(id: string): Promise<RideFile> {
    let file = this.rideFiles.get(id);
    if (!file) {
      file = this.get<RideFile>(`demo-data/rides/${encodeURIComponent(id)}.json`).catch((err) => {
        this.rideFiles.delete(id);
        throw err;
      });
      this.rideFiles.set(id, file);
    }
    return file;
  }

  parks(): Promise<Park[]> {
    return this.get<Park[]>(this.demo ? 'demo-data/parks.json' : `${API_BASE}/parks`);
  }

  attractions(parkId: string): Promise<Attraction[]> {
    return this.get<Attraction[]>(
      this.demo ? `demo-data/attractions/${encodeURIComponent(parkId)}.json` : `${API_BASE}/attractions?parkId=${encodeURIComponent(parkId)}`,
    );
  }

  async bestTimes(attractionId: string, days: number): Promise<BestTimes> {
    if (this.demo) return (await this.ride(attractionId)).bestTimes;
    return this.get<BestTimes>(`${API_BASE}/attractions/${attractionId}/best-times?days=${days}`);
  }

  async trend(attractionId: string, days: number): Promise<Trend> {
    if (this.demo) return (await this.ride(attractionId)).trend;
    return this.get<Trend>(`${API_BASE}/attractions/${attractionId}/trend?days=${days}`);
  }

  /** Details about the saved snapshot; null when talking to the live API. */
  meta(): Promise<DemoMeta | null> {
    return this.demo ? this.get<DemoMeta>('demo-data/meta.json') : Promise.resolve(null);
  }
}
