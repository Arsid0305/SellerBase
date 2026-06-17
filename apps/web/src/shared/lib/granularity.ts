export type Granularity = 'day' | 'week' | 'month' | 'quarter' | 'year';

function toDate(value: Date | string | number): Date {
  return value instanceof Date ? value : new Date(value);
}

/**
 * ISO 8601 week number for a given date.
 * Returns { year, week } where `year` is the ISO week-year
 * (may differ from calendar year for boundary dates).
 */
function isoWeek(date: Date): { year: number; week: number } {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  // ISO weekday: Monday = 1 ... Sunday = 7
  const isoDay = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
  // Shift to the Thursday of the same ISO week — its year determines the ISO week-year.
  d.setUTCDate(d.getUTCDate() + (4 - isoDay));
  const isoYear = d.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { year: isoYear, week };
}

/**
 * Buckets a date into a string key for the given granularity:
 * - day: YYYY-MM-DD
 * - week: YYYY-Www (ISO 8601 week)
 * - month: YYYY-MM
 * - quarter: YYYY-Qn
 * - year: YYYY
 */
export function bucketDate(date: Date | string | number, granularity: Granularity): string {
  const d = toDate(date);

  switch (granularity) {
    case 'day':
      return d.toISOString().slice(0, 10);
    case 'week': {
      const { year, week } = isoWeek(d);
      return `${year}-W${String(week).padStart(2, '0')}`;
    }
    case 'month': {
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, '0');
      return `${y}-${m}`;
    }
    case 'quarter': {
      const y = d.getUTCFullYear();
      const q = Math.floor(d.getUTCMonth() / 3) + 1;
      return `${y}-Q${q}`;
    }
    case 'year':
      return String(d.getUTCFullYear());
  }
}

/**
 * Groups rows by bucketDate(row[dateKey], granularity), summing the numeric
 * fields listed in sumKeys and keeping the first row's dateKey value as the
 * bucket's representative date. Result is sorted by bucket key ascending.
 */
export function aggregateByGranularity<T extends Record<string, unknown>>(
  rows: T[],
  dateKey: keyof T,
  granularity: Granularity,
  sumKeys: (keyof T)[],
): T[] {
  const buckets = new Map<string, T>();

  for (const row of rows) {
    const rawDate = row[dateKey] as unknown as Date | string | number;
    const bucketKey = bucketDate(rawDate, granularity);
    const existing = buckets.get(bucketKey);

    if (!existing) {
      const initial = { ...row } as T;
      for (const key of sumKeys) {
        const value = row[key];
        (initial as Record<keyof T, unknown>)[key] = typeof value === 'number' ? value : 0;
      }
      buckets.set(bucketKey, initial);
      continue;
    }

    for (const key of sumKeys) {
      const value = row[key];
      const current = existing[key];
      const numCurrent = typeof current === 'number' ? current : 0;
      const numValue = typeof value === 'number' ? value : 0;
      (existing as Record<keyof T, unknown>)[key] = numCurrent + numValue;
    }
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([, value]) => value);
}
