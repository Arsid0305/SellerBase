import { describe, expect, it } from 'vitest';
import {
  TAX_PCT,
  ACQUIRING_PCT,
  MARGIN_THRESHOLDS,
  MARGIN_THRESHOLDS_PCT,
  STOCK_DAYS_THRESHOLDS,
  WINDOWS,
  ABC_THRESHOLDS,
  TURNOVER_PROMO,
  SUPPLY_PLAN,
} from '../business-rules';

/**
 * Снимки бизнес-констант. Если кто-то меняет значение — тест падает,
 * заставляет автора правки осознанно обновить снимок и проверить все формулы,
 * которые от константы зависят.
 */
describe('business-rules constants', () => {
  it('TAX_PCT = 0.06 (УСН доходы 6%)', () => {
    expect(TAX_PCT).toBe(0.06);
  });

  it('ACQUIRING_PCT = 0.015 (эквайринг ~1.5%)', () => {
    expect(ACQUIRING_PCT).toBe(0.015);
  });

  it('MARGIN_THRESHOLDS (доли 0..1)', () => {
    expect(MARGIN_THRESHOLDS).toEqual({ loss: 0, low: 0.15, ok: 0.25, high: 0.3 });
  });

  it('MARGIN_THRESHOLDS_PCT (проценты 0..100)', () => {
    expect(MARGIN_THRESHOLDS_PCT).toEqual({ loss: 0, low: 15, ok: 25, high: 30 });
  });

  it('STOCK_DAYS_THRESHOLDS', () => {
    expect(STOCK_DAYS_THRESHOLDS).toEqual({
      critical: 7,
      ok: 14,
      excess: 90,
      overstock: 180,
    });
  });

  it('WINDOWS', () => {
    expect(WINDOWS).toEqual({
      standard: 30,
      funnelAggregate: 30,
      deficitAvgPrice: 90,
      deficitForecast: 14,
      turnover: 28,
    });
  });

  it('ABC_THRESHOLDS', () => {
    expect(ABC_THRESHOLDS).toEqual({ a: 0.8, b: 0.95 });
  });

  it('TURNOVER_PROMO', () => {
    expect(TURNOVER_PROMO).toEqual({
      promoBenefit: 60,
      urgentSell: 90,
      minPromoMargin: 0.1,
    });
  });

  it('SUPPLY_PLAN', () => {
    expect(SUPPLY_PLAN).toEqual({ targetDays: 30, salesWindow: 60 });
  });
});
