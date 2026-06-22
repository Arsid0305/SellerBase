import { describe, expect, it } from 'vitest';
import { buildRecommendation } from '../queries';
import { SUPPLY_PLAN } from '@/shared/lib/business-rules';

describe('buildRecommendation', () => {
  const { salesWindow, targetDays } = SUPPLY_PLAN;

  it('SKU без продаж → все нули', () => {
    const sales = { WH1: 0, WH2: 0 };
    const stocks = { WH1: 100, WH2: 50 };
    const out = buildRecommendation(sales, stocks, 0, 0);
    expect(out).toEqual({ WH1: 0, WH2: 0 });
  });

  it('склад с большим стоком → 0 (need ≤ 0)', () => {
    // velocity=60/60=1; need = 1*30 - 1000 - 0 = -970 → 0
    const out = buildRecommendation({ WH1: 60 }, { WH1: 1000 }, 0, 0);
    expect(out.WH1).toBe(0);
  });

  it('нехватка → положительное число (ceil)', () => {
    // sales=60 за 60д → velocity=1/день; targetDays=30 → need = 30 - 10 - 0 = 20
    const out = buildRecommendation({ WH1: 60 }, { WH1: 10 }, 0, 0);
    expect(out.WH1).toBe(20);
  });

  it('ceil округляет вверх дробное need', () => {
    // sales=61, velocity=61/60; need = 61/60 * 30 - 0 = 30.5 → ceil → 31
    const out = buildRecommendation({ WH1: 61 }, { WH1: 0 }, 0, 0);
    expect(out.WH1).toBe(31);
  });

  it('внешний сток дробится пропорционально share продаж', () => {
    // WH1 sales=60 (share 0.5), WH2 sales=60 (share 0.5); externalTotal = 100+0 = 100
    // velocity_w = 60/60 = 1; need_w = 1*30 - stock_w - 0.5*100 = 30 - stock_w - 50
    // WH1 stock=0 → need = -20 → 0; WH2 stock=0 → -20 → 0
    const out = buildRecommendation({ WH1: 60, WH2: 60 }, { WH1: 0, WH2: 0 }, 100, 0);
    expect(out).toEqual({ WH1: 0, WH2: 0 });
  });

  it('внешний сток не превышает потребность — выдаёт частичную рекомендацию', () => {
    // WH1 sales=120 (share 1.0), velocity=2/день; need = 2*30 - 10 - 1.0*20 = 60-10-20 = 30
    const out = buildRecommendation({ WH1: 120 }, { WH1: 10 }, 20, 0);
    expect(out.WH1).toBe(30);
  });

  it('homeStock и ffStock суммируются как externalTotal', () => {
    // WH1 sales=120 share=1; need = 60 - 0 - 1*(30+10) = 20
    const out = buildRecommendation({ WH1: 120 }, { WH1: 0 }, 30, 10);
    expect(out.WH1).toBe(20);
  });

  it('пустой объект продаж → пустой объект', () => {
    expect(buildRecommendation({}, {}, 0, 0)).toEqual({});
  });

  it('использует константы SUPPLY_PLAN (salesWindow, targetDays)', () => {
    // если кто-то поменяет константы — этот тест защитит формулу
    const sales = 60;
    const stock = 0;
    const out = buildRecommendation({ W: sales }, { W: stock }, 0, 0);
    const expected = Math.ceil((sales / salesWindow) * targetDays - stock);
    expect(out.W).toBe(expected);
  });
});
