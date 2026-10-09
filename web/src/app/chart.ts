import { Component, DestroyRef, ElementRef, effect, inject, input, viewChild } from '@angular/core';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

/** Thin wrapper around Chart.js: pass labels + numbers, it draws a bar or line chart. */
@Component({
  selector: 'app-chart',
  template: `<div class="box"><canvas #canvas role="img" [attr.aria-label]="description()"></canvas></div>`,
  styles: `.box { position: relative; height: 280px; }`,
})
export class ChartComponent {
  readonly type = input<'bar' | 'line'>('bar');
  readonly labels = input.required<string[]>();
  readonly data = input.required<(number | null)[]>();
  readonly label = input('Wait (min)');
  readonly colors = input<string[] | null>(null);
  readonly description = input('Chart');

  private readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('canvas');
  private chart?: Chart;

  constructor() {
    effect(() => {
      const el = this.canvas()?.nativeElement;
      const type = this.type();
      const labels = this.labels();
      const data = this.data();
      const label = this.label();
      const colors = this.colors();
      if (!el) return; // the canvas isn't in the page yet; this effect reruns when it is

      const style = getComputedStyle(el);
      const text = style.getPropertyValue('--muted').trim() || '#666';
      const grid = style.getPropertyValue('--grid').trim() || 'rgba(128,128,128,0.2)';
      const accent = style.getPropertyValue('--accent').trim() || '#2563eb';
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      this.chart?.destroy();
      this.chart = new Chart(el, {
        type,
        data: {
          labels,
          datasets: [{
            label,
            data,
            backgroundColor: colors ?? accent,
            borderColor: type === 'line' ? accent : undefined,
            borderWidth: type === 'line' ? 2 : 0,
            pointRadius: type === 'line' ? 2 : 0,
            tension: 0.25,
            spanGaps: false,
            borderRadius: 4,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: reduceMotion ? false : undefined,
          plugins: { legend: { display: false } },
          scales: {
            x: { ticks: { color: text, maxRotation: 0, autoSkip: true }, grid: { display: false } },
            y: { beginAtZero: true, ticks: { color: text }, grid: { color: grid },
                 title: { display: true, text: label, color: text } },
          },
        },
      });
    });
    inject(DestroyRef).onDestroy(() => this.chart?.destroy());
  }
}
