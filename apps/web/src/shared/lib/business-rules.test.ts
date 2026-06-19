import { describe, expect, it } from 'vitest';
import {
  ACQUIRING_PCT,
  MARGIN_THRESHOLDS,
  MARGIN_THRESHOLDS_PCT,
  STOCK_DAYS_THRESHOLDS,
  TAX_PCT,
} from './business-rules';

describe('business-rules constants', () => {
  it('TAX_PCT is 6% (УСН доходы)', () => {
    expect(TAX_PCT).toBe(0.06);
  });

  it('ACQUIRING_PCT is 1.5%', () => {
    expect(ACQUIRING_PCT).toBe(0.015);
  });

  it('MARGIN_THRESHOLDS.low is 0.15', () => {
    expect(MARGIN_THRESHOLDS.low).toBe(0.15);
  });

  it('MARGIN_THRESHOLDS_PCT.low is 15', () => {
    expect(MARGIN_THRESHOLDS_PCT.low).toBe(15);
  });

  it('STOCK_DAYS_THRESHOLDS.critical is 7', () => {
    expect(STOCK_DAYS_THRESHOLDS.critical).toBe(7);
  });
});
