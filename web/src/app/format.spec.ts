import { formatBucket, formatHour, formatHourRange } from './format';

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
