import type { PnlSummary } from './types';

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
    const drift = Math.sin(i / 5) * (jitter / 4);
    result.push(Math.max(0, Math.round((base + noise + drift) * 100) / 100));
  }
  return result;
}

function buildMarginSeries(): PnlSummary['marginSeries'] {
  const data = buildSeries(73, 32, 8);
  const today = new Date('2026-06-02T00:00:00Z');
  const out: PnlSummary['marginSeries'] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(today.getUTCDate() - i);
    out.push({ date: d.toISOString().slice(0, 10), margin: data[29 - i] ?? 30 });
  }
  return out;
}

export const mockPnlSummary: PnlSummary = {
  period: { from: '2026-05-04', to: '2026-06-02', label: '04 Май — 02 Июн' },
  comparison: { from: '2026-04-04', to: '2026-05-03', label: '04 Апр — 03 Май' },
  kpis: {
    revenue: { value: 355_584, delta: -37, series: buildSeries(13, 12000, 5000) },
    expenses: { value: 241_382, delta: -36, series: buildSeries(41, 8200, 3200) },
    profit: { value: 114_202, delta: -39, series: buildSeries(91, 3500, 1700) },
    margin: { value: 32.1, delta: -1.8, series: buildSeries(73, 32, 8) },
  },
  categories: [
    { key: 'mp_commission', label: 'Комиссия МП', amount: 106_843, share: 30.0, delta: -65_103, group: 'mp' },
    { key: 'cost', label: 'Себестоимость', amount: 73_389, share: 20.6, delta: -41_220, group: 'product' },
    { key: 'processing', label: 'Обработка товара', amount: 34_962, share: 9.8, delta: -19_481, group: 'logistics' },
    { key: 'logistics', label: 'Логистика', amount: 20_568, share: 5.8, delta: -11_478, group: 'logistics' },
    { key: 'acquiring', label: 'Эквайринг', amount: 4_127, share: 1.2, delta: -2_330, group: 'finance' },
    { key: 'marketing', label: 'Маркетинг', amount: 950, share: 0.3, delta: 320, group: 'marketing' },
    { key: 'penalties', label: 'Штрафы', amount: 20, share: 0.0, delta: -180, group: 'penalty' },
    { key: 'other', label: 'Другое', amount: 522, share: 0.1, delta: -240, group: 'other' },
    { key: 'extra', label: 'Доп. расходы', amount: 1_492, share: 0.4, delta: -488, group: 'extra' },
  ],
  marginSeries: buildMarginSeries(),
};
