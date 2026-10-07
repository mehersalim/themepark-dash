import { Component, computed, inject, signal } from '@angular/core';
import { ApiService } from './api.service';
import { ChartComponent } from './chart';
import { formatBucket, formatHour, formatHourRange } from './format';
import { Attraction, BestTimes, Park, Trend } from './models';

const BLUE = '#3b82f6';
const GREEN = '#16a34a';
const RED = '#dc2626';

@Component({
  selector: 'app-root',
  imports: [ChartComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private readonly api = inject(ApiService);

  protected readonly dayOptions = [3, 7, 14, 30];
  protected readonly parks = signal<Park[]>([]);
  protected readonly attractions = signal<Attraction[]>([]);
  protected readonly parkId = signal<string | null>(null);
  protected readonly rideId = signal<string | null>(null);
  protected readonly days = signal(14);
  protected readonly bestTimes = signal<BestTimes | null>(null);
  protected readonly trend = signal<Trend | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  protected readonly formatHourRange = formatHourRange;

  protected readonly currentRide = computed(() => this.attractions().find((a) => a.id === this.rideId()) ?? null);

  protected readonly hourLabels = computed(() => (this.bestTimes()?.hours ?? []).map((h) => formatHour(h.hour)));
  protected readonly hourData = computed(() => (this.bestTimes()?.hours ?? []).map((h) => h.medianWait));
  protected readonly hourColors = computed(() => {
    const bt = this.bestTimes();
    return (bt?.hours ?? []).map((h) => (h.hour === bt?.best?.hour ? GREEN : h.hour === bt?.worst?.hour ? RED : BLUE));
  });

  protected readonly trendLabels = computed(() => (this.trend()?.points ?? []).map((p) => formatBucket(p.bucket)));
  protected readonly trendData = computed(() => (this.trend()?.points ?? []).map((p) => p.avgWait));

  private request = 0; // lets us ignore answers that arrive after the user has moved on

  constructor() {
    void this.init();
  }

  private async init(): Promise<void> {
    await this.run(async () => {
      const parks = await this.api.parks();
      this.parks.set(parks);
      const first = parks.find((p) => p.name.includes('Magic Kingdom')) ?? parks[0];
      if (first) await this.loadPark(first.id);
    });
  }

  private async loadPark(parkId: string): Promise<void> {
    this.parkId.set(parkId);
    const rides = await this.api.attractions(parkId);
    this.attractions.set(rides);
    const pick = rides.find((r) => /space mountain/i.test(r.name)) ?? rides[0];
    if (pick) await this.loadRide(pick.id);
    else {
      this.rideId.set(null);
      this.bestTimes.set(null);
      this.trend.set(null);
    }
  }

  private async loadRide(rideId: string): Promise<void> {
    this.rideId.set(rideId);
    const [bestTimes, trend] = await Promise.all([
      this.api.bestTimes(rideId, this.days()),
      this.api.trend(rideId, this.days()),
    ]);
    this.bestTimes.set(bestTimes);
    this.trend.set(trend);
  }

  private async run(work: () => Promise<void>): Promise<void> {
    const id = ++this.request;
    this.loading.set(true);
    this.error.set(null);
    try {
      await work();
    } catch {
      if (id === this.request) this.error.set('Could not load data. The API may be waking up: wait a few seconds and try again.');
    } finally {
      if (id === this.request) this.loading.set(false);
    }
  }

  protected onPark(event: Event): void {
    const id = (event.target as HTMLSelectElement).value;
    void this.run(() => this.loadPark(id));
  }
  protected onRide(event: Event): void {
    const id = (event.target as HTMLSelectElement).value;
    void this.run(() => this.loadRide(id));
  }
  protected onDays(event: Event): void {
    this.days.set(Number((event.target as HTMLSelectElement).value));
    const id = this.rideId();
    if (id) void this.run(() => this.loadRide(id));
  }
  protected retry(): void {
    const id = this.rideId();
    const park = this.parkId();
    if (id) void this.run(() => this.loadRide(id));
    else if (park) void this.run(() => this.loadPark(park));
    else void this.init();
  }
}
