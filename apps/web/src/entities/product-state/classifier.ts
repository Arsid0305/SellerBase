import type { LifecycleInput, ProductLifecycleState } from './types';

/**
 * Чистая функция-классификатор. Реверсивная из VISION.md.
 * Порядок проверки важен: ARCHIVED → CRITICAL → NEW → LEADER → GROWING/DECLINING → STABLE.
 */
export function classifyLifecycle(input: LifecycleInput): ProductLifecycleState {
  if (!input.isActive) return 'ARCHIVED';

  // Critical: спрос есть, а стока нет
  if (input.stock <= 0 && input.unitsPerDay > 0) return 'CRITICAL';
  // Critical: сток есть, а продаж нет больше 14 дней
  if (input.stock > 0 && input.daysSinceLastSale > 14) return 'CRITICAL';

  // New: слишком мало истории
  if (input.daysInCatalog < 14) return 'NEW';

  const prev = input.revenue14dPrev;
  const cur = input.revenue14d;
  const deltaRatio = prev > 0 ? (cur - prev) / prev : cur > 0 ? 1 : 0;

  // Leader: топ по выручке + высокая маржа + не падает
  if (input.isTopRevenue && input.marginPct >= 20 && deltaRatio >= -0.2) {
    return 'LEADER';
  }

  if (deltaRatio >= 0.2) return 'GROWING';
  if (deltaRatio <= -0.2) return 'DECLINING';
  return 'STABLE';
}
