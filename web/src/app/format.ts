/** 0 -> "12 AM", 13 -> "1 PM" */
export function formatHour(hour: number): string {
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12} ${hour < 12 ? 'AM' : 'PM'}`;
}

/** 9 -> "9 AM – 10 AM" */
export function formatHourRange(hour: number): string {
  return `${formatHour(hour)} – ${formatHour((hour + 1) % 24)}`;
}

/** "2026-10-05T14:00:00Z" -> "Oct 5, 10 AM" in the given time zone (default: Eastern, where the parks are). */
export function formatBucket(iso: string, timeZone = 'America/New_York'): string {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', timeZone }).format(new Date(iso));
}

/** "2026-10-05T14:00:00Z" -> "Oct 5" (Eastern time) */
export function formatDay(iso: string, timeZone = 'America/New_York'): string {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone }).format(new Date(iso));
}

/** Sort key so a park day reads in order: hours after midnight (0 to 3 AM) come after 11 PM, not before 7 AM. */
export function parkDayOrder(hour: number): number {
  return hour < 4 ? hour + 24 : hour;
}
