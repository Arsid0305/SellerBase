import type { TurnoverSegmentKey } from '@/features/turnover/types';

/**
 * Сегмент по оборачиваемости — простой прокси по «хватит на N дней».
 *
 *  stable    — здоровый товарооборот (30 ≤ daysToOos ≤ 90)
 *  medium    — выходит из зоны комфорта (7-30 или 90-180)
 *  unstable  — критика: нет продаж, мало остатков (<7), избыточный сток (>180)
 *
 * Pure function — выделена для тестирования.
 */
export function classifyTurnover(
  daysToOos: number,
  unitsPerDay: number,
): Exclude<TurnoverSegmentKey, 'all'> {
  if (unitsPerDay <= 0) return 'unstable';
  if (daysToOos < 7) return 'unstable';
  if (daysToOos > 180) return 'unstable';
  if (daysToOos >= 30 && daysToOos <= 90) return 'stable';
  return 'medium';
}
