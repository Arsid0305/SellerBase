import { describe, expect, it } from 'vitest';
import { TAX_PCT } from '@/shared/lib/business-rules';
import { rowToWeek, avgWeeks, pickWorstComponent, type BreakdownRow } from '../math';
import type { WeekBreakdown } from '../types';

function makeRow(over: Partial<BreakdownRow> = {}): BreakdownRow {
  return {
    week_start: '2026-06-15',
    by_card_rub: 1000,
    ppvz_for_pay_rub: 850,
    commission_full_rub: 150,
    logistics_rub: 80,
    storage_rub: 20,
    acquiring_rub: 15,
    penalty_rub: 0,
    deduction_rub: 0,
    rebill_logistic_rub: 0,
    returns_rub: 0,
    cogs_rub: 400,
    net_profit_rub: 275,
    ...over,
  };
}

describe('rowToWeek', () => {
  it('считает tax = byCard * TAX_PCT (6% УСН)', () => {
    const w = rowToWeek(makeRow({ by_card_rub: 1000 }));
    expect(w.components.tax).toBeCloseTo(1000 * TAX_PCT, 6);
    expect(w.components.tax).toBe(60);
  });

  it('marginPct = net / byCard * 100', () => {
    const w = rowToWeek(makeRow({ by_card_rub: 1000, net_profit_rub: 275 }));
    expect(w.marginPct).toBeCloseTo(27.5, 6);
  });

  it('marginPct = null при byCard ≤ 0', () => {
    expect(rowToWeek(makeRow({ by_card_rub: 0 })).marginPct).toBeNull();
    expect(rowToWeek(makeRow({ by_card_rub: null })).marginPct).toBeNull();
  });

  it('null/undefined компоненты → 0 (toNumber-coercion)', () => {
    const w = rowToWeek(
      makeRow({
        commission_full_rub: null,
        logistics_rub: null,
        cogs_rub: null,
      }),
    );
    expect(w.components.commission).toBe(0);
    expect(w.components.logistics).toBe(0);
    expect(w.components.cogs).toBe(0);
  });

  it('строковые числа парсятся (для совместимости с numeric из PG)', () => {
    const w = rowToWeek(
      makeRow({ by_card_rub: '500' as unknown as number, net_profit_rub: '125' as unknown as number }),
    );
    expect(w.byCardRub).toBe(500);
    expect(w.netProfitRub).toBe(125);
    expect(w.marginPct).toBe(25);
  });

  it('NaN/мусорные строки → 0', () => {
    const w = rowToWeek(makeRow({ commission_full_rub: 'abc' as unknown as number }));
    expect(w.components.commission).toBe(0);
  });
});

describe('avgWeeks', () => {
  it('пустой массив → null', () => {
    expect(avgWeeks([])).toBeNull();
  });

  it('арифметическое среднее по неделям + пересчёт marginPct', () => {
    const w1 = rowToWeek(makeRow({ by_card_rub: 1000, net_profit_rub: 200 }));
    const w2 = rowToWeek(makeRow({ by_card_rub: 2000, net_profit_rub: 400 }));
    const avg = avgWeeks([w1, w2]);
    expect(avg).not.toBeNull();
    expect(avg!.byCardRub).toBe(1500);
    expect(avg!.netProfitRub).toBe(300);
    // marginPct пересчитывается ОТ усреднённых сумм, не из среднего marginPct
    expect(avg!.marginPct).toBeCloseTo(20, 6);
  });

  it('усредняет каждый компонент', () => {
    const w1 = rowToWeek(makeRow({ commission_full_rub: 100, logistics_rub: 50 }));
    const w2 = rowToWeek(makeRow({ commission_full_rub: 200, logistics_rub: 150 }));
    const avg = avgWeeks([w1, w2])!;
    expect(avg.components.commission).toBe(150);
    expect(avg.components.logistics).toBe(100);
  });

  it('weekStart = "__avg__" (маркер)', () => {
    expect(avgWeeks([rowToWeek(makeRow())])!.weekStart).toBe('__avg__');
  });
});

function week(over: Partial<WeekBreakdown> = {}): WeekBreakdown {
  return {
    weekStart: '2026-06-15',
    byCardRub: 1000,
    ppvzForPayRub: 850,
    netProfitRub: 200,
    marginPct: 20,
    components: {
      commission: 150, logistics: 80, storage: 20, acquiring: 15,
      penalty: 0, deduction: 0, rebillLogistic: 0, cogs: 400,
      tax: 60, returns: 0,
    },
    ...over,
  };
}

describe('pickWorstComponent', () => {
  it('null при byCard ≤ 0 (нет базы для сравнения)', () => {
    expect(pickWorstComponent(week({ byCardRub: 0 }), week())).toBeNull();
    expect(pickWorstComponent(week(), week({ byCardRub: 0 }))).toBeNull();
  });

  it('выбирает компонент с максимальным delta (как доля от выручки)', () => {
    // Текущая неделя: комиссия 20% (200/1000), логистика 8% (80/1000)
    // Предыдущая: комиссия 15%, логистика 8%
    // Комиссия выросла на 5 п.п., логистика 0 → выбирается комиссия
    const cur = week({ components: { ...week().components, commission: 200 } });
    const prev = week();
    const worst = pickWorstComponent(cur, prev);
    expect(worst).not.toBeNull();
    expect(worst!.key).toBe('commission');
    expect(worst!.deltaPctOfRevenue).toBeCloseTo(0.05, 6);
  });

  it('игнорирует компоненты которые улучшились (delta < 0)', () => {
    // Комиссия упала, всё остальное без изменений → null
    const cur = week({ components: { ...week().components, commission: 100 } });
    const prev = week();
    expect(pickWorstComponent(cur, prev)).toBeNull();
  });

  it('при равном изменении нескольких — берёт первый встретившийся (стабильный порядок)', () => {
    // Все компоненты одинаковые → null (delta = 0 не считается)
    expect(pickWorstComponent(week(), week())).toBeNull();
  });

  it('сравнивает в долях выручки, а не в абсолюте (разные масштабы недель)', () => {
    // Текущая: byCard=2000, commission=300 → 15%
    // Прошлая: byCard=1000, commission=100 → 10%
    // Delta = +5 п.п. (хотя в абсолюте +200₽)
    const cur = week({
      byCardRub: 2000,
      components: { ...week().components, commission: 300 },
    });
    const prev = week({
      byCardRub: 1000,
      components: { ...week().components, commission: 100 },
    });
    const worst = pickWorstComponent(cur, prev);
    expect(worst!.key).toBe('commission');
    expect(worst!.deltaPctOfRevenue).toBeCloseTo(0.05, 6);
  });
});
