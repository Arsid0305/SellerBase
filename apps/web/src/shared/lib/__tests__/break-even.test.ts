import { describe, expect, it } from 'vitest';
import { computeBreakEven } from '../break-even';
import { ACQUIRING_PCT, TAX_PCT } from '../business-rules';

describe('computeBreakEven', () => {
  it('все нули → 0', () => {
    expect(
      computeBreakEven({
        costPerUnit: 0,
        logisticsPerUnit: 0,
        storagePerUnit: 0,
        commissionPct: 0,
        returnsPct: 0,
      }),
    ).toBe(0);
  });

  it('denom > 0 → fixed / (1 - variableShare)', () => {
    const input = {
      costPerUnit: 100,
      logisticsPerUnit: 20,
      storagePerUnit: 5,
      commissionPct: 0.2,
      returnsPct: 0.05,
    };
    const fixed = 100 + 20 + 5;
    const variable = 0.2 + ACQUIRING_PCT + TAX_PCT + 0.05;
    expect(computeBreakEven(input)).toBeCloseTo(fixed / (1 - variable), 9);
  });

  it('denom = 0 → Infinity', () => {
    const commissionPct = 1 - ACQUIRING_PCT - TAX_PCT;
    expect(
      computeBreakEven({
        costPerUnit: 100,
        logisticsPerUnit: 0,
        storagePerUnit: 0,
        commissionPct,
        returnsPct: 0,
      }),
    ).toBe(Number.POSITIVE_INFINITY);
  });

  it('denom < 0 → Infinity', () => {
    expect(
      computeBreakEven({
        costPerUnit: 100,
        logisticsPerUnit: 0,
        storagePerUnit: 0,
        commissionPct: 0.95,
        returnsPct: 0.1,
      }),
    ).toBe(Number.POSITIVE_INFINITY);
  });

  it('типичный кейс price-simulator: 360 / 0.695', () => {
    const result = computeBreakEven({
      costPerUnit: 300,
      logisticsPerUnit: 50,
      storagePerUnit: 10,
      commissionPct: 0.18,
      returnsPct: 0.05,
    });
    expect(result).toBeCloseTo(360 / 0.695, 6);
    expect(Number.isFinite(result)).toBe(true);
  });
});
