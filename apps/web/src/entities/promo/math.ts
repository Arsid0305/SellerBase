import { TURNOVER_PROMO } from '@/shared/lib/business-rules';

export type CellLight = 'green' | 'yellow' | 'red' | 'unknown';

export function classifyRecommendation(
  turnoverDays: number | null,
  marginPromoPct: number | null,
): boolean {
  if (turnoverDays == null) return false;
  if (turnoverDays > TURNOVER_PROMO.urgentSell) return true;
  if (
    turnoverDays >= TURNOVER_PROMO.promoBenefit &&
    marginPromoPct != null &&
    marginPromoPct >= TURNOVER_PROMO.minPromoMargin
  )
    return true;
  return false;
}

/**
 * Светофор per (SKU × акция): стоит ли участвовать.
 *  🟢 green   — маржа после акции ≥25% (хорошо) ИЛИ срочно сливать (>90д) и маржа ≥10%
 *  🟡 yellow  — маржа 10-25% и оборачиваемость в норме / на грани
 *  🔴 red     — маржа после акции <10% (невыгодно даже на оборот) ИЛИ оборачиваемость <7д
 *  ⚪ unknown — нет данных по марже
 */
export function classifyCellLight(
  turnoverDays: number | null,
  marginPromoPct: number | null,
): CellLight {
  if (marginPromoPct == null) return 'unknown';
  if (turnoverDays != null && turnoverDays < 7) return 'red';
  if (marginPromoPct < TURNOVER_PROMO.minPromoMargin) return 'red';
  if (marginPromoPct >= 0.25) return 'green';
  if (turnoverDays != null && turnoverDays > TURNOVER_PROMO.urgentSell) return 'green';
  return 'yellow';
}
