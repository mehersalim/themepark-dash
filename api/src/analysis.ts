export interface HourStat {
  hour: number;        // 0-23, park-local time
  avgWait: number;
  medianWait: number;
  samples: number;
}

export interface BestTimes {
  best: HourStat | null;
  worst: HourStat | null;
}

/**
 * Pick the best (lowest median wait) and worst (highest) hours.
 * Hours with fewer than `minSamples` readings are ignored so one odd
 * reading can't win. Ties on median are broken by the lower average.
 */
export function pickBestHours(rows: HourStat[], minSamples = 3): BestTimes {
  const usable = rows.filter((r) => r.samples >= minSamples);
  if (usable.length === 0) return { best: null, worst: null };
  const byLow = [...usable].sort(
    (a, b) => a.medianWait - b.medianWait || a.avgWait - b.avgWait || a.hour - b.hour,
  );
  return { best: byLow[0], worst: byLow[byLow.length - 1] };
}
