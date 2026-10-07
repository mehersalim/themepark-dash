import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE } from './config';
import { Attraction, BestTimes, Park, Trend } from './models';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  parks(): Promise<Park[]> {
    return firstValueFrom(this.http.get<Park[]>(`${API_BASE}/parks`));
  }
  attractions(parkId: string): Promise<Attraction[]> {
    return firstValueFrom(this.http.get<Attraction[]>(`${API_BASE}/attractions?parkId=${encodeURIComponent(parkId)}`));
  }
  bestTimes(attractionId: string, days: number): Promise<BestTimes> {
    return firstValueFrom(this.http.get<BestTimes>(`${API_BASE}/attractions/${attractionId}/best-times?days=${days}`));
  }
  trend(attractionId: string, days: number): Promise<Trend> {
    return firstValueFrom(this.http.get<Trend>(`${API_BASE}/attractions/${attractionId}/trend?days=${days}`));
  }
}
