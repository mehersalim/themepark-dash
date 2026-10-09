import { withGaps } from './series';
import { TrendPoint } from './models';

const point = (bucket: string, avgWait: number): TrendPoint => ({ bucket, avgWait, maxWait: avgWait, samples: 6 });
const label = (iso: string) => iso.slice(11, 13);

describe('withGaps', () => {
  it('keeps consecutive hours connected', () => {
    const s = withGaps([point('2026-10-05T14:00:00Z', 20), point('2026-10-05T15:00:00Z', 30)], label);
    expect(s.data).toEqual([20, 30]);
    expect(s.labels).toEqual(['14', '15']);
  });

  it('breaks the line across a long overnight gap', () => {
    const s = withGaps([point('2026-10-05T23:00:00Z', 10), point('2026-10-06T13:00:00Z', 15)], label);
    expect(s.data).toEqual([10, null, 15]);
    expect(s.labels).toEqual(['23', '', '13']);
  });

  it('handles an empty list', () => {
    expect(withGaps([], label)).toEqual({ labels: [], data: [] });
  });
});
