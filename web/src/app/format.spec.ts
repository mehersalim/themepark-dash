import { formatBucket, formatDay, formatHour, formatHourRange, parkDayOrder } from './format';

describe('formatHour', () => {
  it('handles midnight, noon and the afternoon', () => {
    expect(formatHour(0)).toBe('12 AM');
    expect(formatHour(9)).toBe('9 AM');
    expect(formatHour(12)).toBe('12 PM');
    expect(formatHour(13)).toBe('1 PM');
    expect(formatHour(23)).toBe('11 PM');
  });
  it('builds a range that wraps past midnight', () => {
    expect(formatHourRange(9)).toBe('9 AM – 10 AM');
    expect(formatHourRange(23)).toBe('11 PM – 12 AM');
  });
});

describe('formatBucket', () => {
  it('converts UTC to Eastern time', () => {
    expect(formatBucket('2026-10-05T14:00:00Z')).toContain('10 AM');
  });
});

describe('formatDay', () => {
  it('uses the Eastern calendar day', () => {
    expect(formatDay('2026-10-06T02:00:00Z')).toBe('Oct 5'); // 10 PM the night before, in Eastern time
  });
});

describe('parkDayOrder', () => {
  it('puts after-midnight hours at the end of the park day', () => {
    const hours = [0, 7, 23, 1, 12];
    expect([...hours].sort((a, b) => parkDayOrder(a) - parkDayOrder(b))).toEqual([7, 12, 23, 0, 1]);
  });
});
