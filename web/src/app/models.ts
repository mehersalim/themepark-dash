export interface Park { id: string; name: string; timezone: string; attractions: number }

export interface Attraction {
  id: string;
  name: string;
  parkId: string | null;
  status: string | null;       // only present if reported in the last 30 minutes
  currentWait: number | null;  // only present if reported in the last 30 minutes
}

export interface HourStat { hour: number; avgWait: number; medianWait: number; samples: number }

export interface BestTimes {
  attractionId: string;
  days: number;
  best: HourStat | null;
  worst: HourStat | null;
  hours: HourStat[];
}

export interface TrendPoint { bucket: string; avgWait: number; maxWait: number; samples: number }
export interface Trend { attractionId: string; days: number; points: TrendPoint[] }
