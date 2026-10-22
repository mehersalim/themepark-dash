import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { API_BASE } from './config';
import { IS_DEMO } from './demo';

const tick = () => new Promise<void>((r) => setTimeout(r));

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
  });

  it('loads parks, then the first Magic Kingdom attractions', async () => {
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    http.expectOne(`${API_BASE}/parks`).flush([
      { id: 'p1', name: 'EPCOT', timezone: 'America/New_York', attractions: 3 },
      { id: 'p2', name: 'Magic Kingdom Park', timezone: 'America/New_York', attractions: 5 },
    ]);
    await tick();

    // it should ask for the Magic Kingdom's rides, not EPCOT's
    http.expectOne(`${API_BASE}/attractions?parkId=p2`).flush([]);
    await tick();
    fixture.detectChanges();

    const options = Array.from(fixture.nativeElement.querySelectorAll('select')[0].options as HTMLOptionElement[]);
    expect(options.map((o) => o.textContent?.trim())).toEqual(['EPCOT', 'Magic Kingdom Park']);
    http.verify();
  });

  it('shows a friendly error when the API fails', async () => {
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    http.expectOne(`${API_BASE}/parks`).flush('boom', { status: 500, statusText: 'Server Error' });
    await tick();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain('Could not load data');
  });

  it('in demo mode shows a banner, hides live-only controls, and reads saved files', async () => {
    TestBed.overrideProvider(IS_DEMO, { useValue: true });
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    http.expectOne('demo-data/parks.json').flush([{ id: 'p1', name: 'Magic Kingdom Park', timezone: 'America/New_York', attractions: 1 }]);
    http.expectOne('demo-data/meta.json').flush({
      generatedAt: '2026-11-01T00:00:00Z', days: 30, from: '2026-10-05T14:00:00Z', to: '2026-11-01T00:00:00Z',
      readings: 1234, rides: 7, parks: 1,
    });
    await tick();
    http.expectOne('demo-data/attractions/p1.json').flush([]);
    await tick();
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.banner')?.textContent).toContain('Oct 5 to Oct 31');
    expect(el.querySelector('.banner')?.textContent).toContain('1,234 readings');
    expect(el.querySelector('.banner')?.textContent).not.toMatch(/\)\s+\./); // no stray space before the period
    expect(el.textContent).not.toContain('Look back');
    http.verify();
  });
});
