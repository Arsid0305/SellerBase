import { ACQUIRING_PCT, TAX_PCT } from './business-rules';

export type BreakEvenInput = {
  costPerUnit: number;
  logisticsPerUnit: number;
  storagePerUnit: number;
  /** Доля комиссии маркетплейса в выручке (0..1). */
  commissionPct: number;
  /** Доля возвратов (0..1). */
  returnsPct: number;
};

/**
 * Точка безубыточности на единицу:
 *   breakEven = fixed / (1 - variableShare),
 * где fixed = себестоимость + логистика + хранение (на единицу),
 *     variableShare = комиссия + эквайринг + налог + возвраты.
 *
 * Если variableShare ≥ 1 — точка недостижима, возвращаем POSITIVE_INFINITY,
 * чтобы UI явно показывал «—» вместо отрицательного/мусорного числа.
 */
export function computeBreakEven(input: BreakEvenInput): number {
  const { costPerUnit, logisticsPerUnit, storagePerUnit, commissionPct, returnsPct } = input;
  const fixedPerUnit = costPerUnit + logisticsPerUnit + storagePerUnit;
  const variableShare = commissionPct + ACQUIRING_PCT + TAX_PCT + returnsPct;
  const denom = 1 - variableShare;
  return denom > 0 ? fixedPerUnit / denom : Number.POSITIVE_INFINITY;
}
