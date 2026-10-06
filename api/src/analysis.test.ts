import { describe, expect, it } from 'vitest';
import { pickBestHours, HourStat } from './analysis';

const h = (hour: number, medianWait: number, samples = 10, avgWait = medianWait): HourStat => ({
  hour, avgWait, medianWait, samples,
});

describe('pickBestHours', () => {
  it('returns nulls when there is no data', () => {
    expect(pickBestHours([])).toEqual({ best: null, worst: null });
  });

  it('picks the lowest and highest median', () => {
    const { best, worst } = pickBestHours([h(9, 30), h(13, 70), h(20, 15)]);
    expect(best?.hour).toBe(20);
    expect(worst?.hour).toBe(13);
  });

  it('ignores hours with too few samples', () => {
    const { best } = pickBestHours([h(3, 0, 1), h(9, 30), h(13, 70)]);
    expect(best?.hour).toBe(9);
  });

  it('breaks median ties with the lower average, then earlier hour', () => {
    expect(pickBestHours([h(10, 20, 10, 25), h(11, 20, 10, 22)]).best?.hour).toBe(11);
    expect(pickBestHours([h(11, 20), h(10, 20)]).best?.hour).toBe(10);
  });

  it('returns the same hour for best and worst when only one is usable', () => {
    const r = pickBestHours([h(9, 30)]);
    expect(r.best?.hour).toBe(9);
    expect(r.worst?.hour).toBe(9);
  });
});
