import type { DashboardSummary } from './types';

/**
 * Mock data для M1 (Сводка). Цифры подобраны по скринам InSales-референса.
 * После подключения реального Supabase этот файл останется для Storybook / тестов.
 */

function pseudoRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function buildSeries(seed: number, base: number, jitter: number, length = 30): number[] {
  const rand = pseudoRandom(seed);
  const result: number[] = [];
  for (let i = 0; i < length; i++) {
    const noise = (rand() - 0.5) * jitter;
    const drift = Math.sin(i / 4) * (jitter / 3);
    result.push(Math.max(0, Math.round(base + noise + drift)));
  }
  return result;
}

function buildDailyPoints(): DashboardSummary['series'] {
  const revenue = buildSeries(13, 12000, 5000);
  const expenses = buildSeries(41, 8200, 3200);
  const out: DashboardSummary['series'] = [];
  const today = new Date('2026-06-02T00:00:00Z');
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(today.getUTCDate() - i);
    out.push({
      date: d.toISOString().slice(0, 10),
      revenue: revenue[29 - i] ?? 0,
      expenses: expenses[29 - i] ?? 0,
    });
  }
  return out;
}

export const mockDashboardSummary: DashboardSummary = {
  period: { from: '2026-05-04', to: '2026-06-02', label: '04 Май — 02 Июн' },
  comparison: { from: '2026-04-04', to: '2026-05-03', label: '04 Апр — 03 Май' },
  kpis: {
    revenue: {
      label: 'Доходы',
      value: 355_584,
      delta: -37,
      series: buildSeries(13, 12000, 5000),
      hint: 'Продажи + остальные доходы',
    },
    mainExpenses: {
      label: 'Основные расходы',
      value: 239_890,
      delta: -36,
      series: buildSeries(41, 8200, 3200),
      hint: 'Комиссия + логистика + эквайринг + себестоимость',
    },
    extraExpenses: {
      label: 'Доп. расходы',
      value: 1_492,
      delta: -33,
      series: buildSeries(57, 50, 25),
      hint: 'Маркетинг + штрафы + другое',
    },
    profit: {
      label: 'Прибыль',
      value: 114_203,
      delta: -39,
      series: buildSeries(91, 3500, 1700),
      hint: 'Маржа 32.1%',
    },
  },
  channels: [
    { channel: 'WB', label: 'Wildberries', share: 80, delta: 2, amount: 283_267 },
    { channel: 'OZON', label: 'Ozon', share: 20, delta: -2, amount: 71_318 },
  ],
  series: buildDailyPoints(),
};
