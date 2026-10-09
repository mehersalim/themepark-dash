import { TrendPoint } from './models';

export interface Series { labels: string[]; data: (number | null)[] }

/**
 * Turn hourly trend points into chart series, inserting a break wherever consecutive readings are
 * more than `maxGapHours` apart (e.g. overnight, when the parks are closed). A `null` value makes
 * the line stop instead of drawing a misleading slope across the gap.
 */
export function withGaps(points: TrendPoint[], format: (iso: string) => string, maxGapHours = 3): Series {
  const labels: string[] = [];
  const data: (number | null)[] = [];
  let previous: number | null = null;
  for (const p of points) {
    const time = new Date(p.bucket).getTime();
    if (previous !== null && (time - previous) / 3_600_000 > maxGapHours) {
      labels.push('');
      data.push(null);
    }
    labels.push(format(p.bucket));
    data.push(p.avgWait);
    previous = time;
  }
  return { labels, data };
}
