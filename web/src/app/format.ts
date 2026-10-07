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
