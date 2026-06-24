import { describe, expect, it } from 'vitest';
import { TURNOVER_PROMO } from '@/shared/lib/business-rules';
import { classifyCellLight, classifyRecommendation } from '../math';

describe('classifyRecommendation', () => {
  it('turnoverDays = null → false (нет данных по оборачиваемости)', () => {
    expect(classifyRecommendation(null, 0.5)).toBe(false);
    expect(classifyRecommendation(null, null)).toBe(false);
  });

  it('turnoverDays > urgentSell (>90) → true даже без маржи (сливать)', () => {
    expect(classifyRecommendation(91, null)).toBe(true);
    expect(classifyRecommendation(120, 0.05)).toBe(true);
  });

  it('turnoverDays >= promoBenefit (60) И marginPromoPct >= minPromoMargin (0.10) → true', () => {
    expect(classifyRecommendation(60, 0.10)).toBe(true);
    expect(classifyRecommendation(75, 0.20)).toBe(true);
  });

  it('turnoverDays >= promoBenefit но marginPromoPct < minPromoMargin → false', () => {
    expect(classifyRecommendation(60, 0.09)).toBe(false);
    expect(classifyRecommendation(75, null)).toBe(false);
  });

  it('turnoverDays < promoBenefit (нормальная оборачиваемость) → false', () => {
    expect(classifyRecommendation(30, 0.30)).toBe(false);
    expect(classifyRecommendation(59, 0.50)).toBe(false);
  });

  it('границы констант не сдвигались (regression-guard)', () => {
    expect(TURNOVER_PROMO).toEqual({
      promoBenefit: 60,
      urgentSell: 90,
      minPromoMargin: 0.1,
    });
  });
});

describe('classifyCellLight', () => {
  it('marginPromoPct = null → unknown (даже если есть turnover)', () => {
    expect(classifyCellLight(30, null)).toBe('unknown');
    expect(classifyCellLight(null, null)).toBe('unknown');
  });

  it('turnoverDays < 7 (товар скоро кончится) → red, перебивает хорошую маржу', () => {
    expect(classifyCellLight(6, 0.40)).toBe('red');
    expect(classifyCellLight(0, 0.50)).toBe('red');
  });

  it('marginPromoPct < minPromoMargin (0.10) → red', () => {
    expect(classifyCellLight(30, 0.09)).toBe('red');
    expect(classifyCellLight(30, 0)).toBe('red');
    expect(classifyCellLight(30, -0.05)).toBe('red');
  });

  it('marginPromoPct >= 0.25 → green', () => {
    expect(classifyCellLight(30, 0.25)).toBe('green');
    expect(classifyCellLight(30, 0.40)).toBe('green');
  });

  it('turnoverDays > urgentSell (>90) и маржа выше minPromoMargin → green (сливаем)', () => {
    expect(classifyCellLight(91, 0.10)).toBe('green');
    expect(classifyCellLight(180, 0.15)).toBe('green');
  });

  it('маржа 10-25% и оборачиваемость в норме → yellow', () => {
    expect(classifyCellLight(30, 0.15)).toBe('yellow');
    expect(classifyCellLight(60, 0.20)).toBe('yellow');
    expect(classifyCellLight(90, 0.24)).toBe('yellow');
  });

  it('turnoverDays = null: маржа 10-25% → yellow, ≥25% → green (marginOk без stock-check)', () => {
    expect(classifyCellLight(null, 0.15)).toBe('yellow');
    // Дизайн: при marginPromoPct ≥ 0.25 светофор зелёный даже без turnover —
    // высокая маржа сама по себе достаточна для рекомендации участия.
    expect(classifyCellLight(null, 0.25)).toBe('green');
  });

  it('пограничные значения (точное равенство порогам)', () => {
    expect(classifyCellLight(7, 0.10)).toBe('yellow'); // ровно 7 — не red, ровно 0.10 — не red
    expect(classifyCellLight(90, 0.10)).toBe('yellow'); // ровно 90 — не green по urgentSell (>90, не >=)
  });
});
