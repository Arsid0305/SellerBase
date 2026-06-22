import type { ProfitTier, SalesTier, StabilityTier } from '@/features/analytics/types';

/**
 * Profit tier по марже в %.
 * PPP ≥ 30%, PP 15–30%, P 0–15%, -P < 0
 */
export function classifyProfit(marginPct: number): ProfitTier {
  if (marginPct >= 30) return 'PPP';
  if (marginPct >= 15) return 'PP';
  if (marginPct >= 0) return 'P';
  return '-P';
}

/**
 * XYZ по коэффициенту вариации продаж.
 * Массив daily — продажи по дням, включая нули в дни без продаж.
 * X: cv < 0.10, Y: cv 0.10–0.25, Z: cv ≥ 0.25 или мало данных (<7) или mean ≤ 0.
 */
export function classifyStability(daily: number[]): StabilityTier {
  if (daily.length < 7) return 'Z';
  const mean = daily.reduce((a, b) => a + b, 0) / daily.length;
  if (mean <= 0) return 'Z';
  const variance = daily.reduce((acc, v) => acc + (v - mean) ** 2, 0) / daily.length;
  const cv = Math.sqrt(variance) / mean;
  if (cv < 0.1) return 'X';
  if (cv < 0.25) return 'Y';
  return 'Z';
}

/**
 * ABC по накопленной доле выручки: A — верхние 80%, B — следующие 15%, C — последние 5%.
 * Если total ≤ 0 — все SKU получают 'C'. Пустой массив → пустой Map.
 */
export function classifySales(skus: { id: number; revenue: number }[]): Map<number, SalesTier> {
  const sorted = [...skus].sort((a, b) => b.revenue - a.revenue);
  const total = sorted.reduce((acc, s) => acc + s.revenue, 0);
  const map = new Map<number, SalesTier>();
  if (total <= 0) {
    for (const s of sorted) map.set(s.id, 'C');
    return map;
  }
  let cumulative = 0;
  for (const s of sorted) {
    cumulative += s.revenue;
    const pct = (cumulative / total) * 100;
    if (pct <= 80) map.set(s.id, 'A');
    else if (pct <= 95) map.set(s.id, 'B');
    else map.set(s.id, 'C');
  }
  return map;
}
