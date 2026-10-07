import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { API_BASE } from './config';

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
});
