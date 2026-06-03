import type { TurnoverProduct, TurnoverSegment, TurnoverDynamicsPoint } from './types';

export const turnoverSegments: TurnoverSegment[] = [
  {
    key: 'all',
    label: 'Все',
    count: 241,
    share: 100,
    salesUnits: 503,
    salesRevenue: 354_086,
    stockUnits: 2910,
    excessCount: 105,
    outOfStockCount: 110,
  },
  {
    key: 'stable',
    label: 'Стабильная',
    count: 7,
    share: 2.9,
    salesUnits: 19,
    salesRevenue: 13_549,
    stockUnits: 72,
    excessCount: 3,
    outOfStockCount: 4,
  },
  {
    key: 'medium',
    label: 'Средняя',
    count: 97,
    share: 40.25,
    salesUnits: 225,
    salesRevenue: 161_556,
    stockUnits: 1014,
    excessCount: 37,
    outOfStockCount: 47,
  },
  {
    key: 'unstable',
    label: 'Нестабильная',
    count: 137,
    share: 56.85,
    salesUnits: 259,
    salesRevenue: 178_981,
    stockUnits: 1824,
    excessCount: 65,
    outOfStockCount: 59,
  },
];

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
    result.push(Math.max(0, Math.round(base + noise + drift)));
  }
  return result;
}

export function buildTurnoverDynamics(): TurnoverDynamicsPoint[] {
  const stableSeries = buildSeries(31, 18, 12);
  const mediumSeries = buildSeries(57, 17, 14);
  const unstableSeries = buildSeries(89, 17, 18);
  const today = new Date('2026-06-02T00:00:00Z');
  const out: TurnoverDynamicsPoint[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(today.getUTCDate() - i);
    out.push({
      date: d.toISOString().slice(0, 10),
      stable: stableSeries[29 - i] ?? 0,
      medium: mediumSeries[29 - i] ?? 0,
      unstable: unstableSeries[29 - i] ?? 0,
    });
  }
  return out;
}

export const turnoverDynamics = buildTurnoverDynamics();

export const mockTurnoverProducts: TurnoverProduct[] = [
  {
    id: '1',
    name: 'Мяч массажный для стоп',
    barcode: 'ACRB1MS106WH',
    channel: 'WB',
    tags: ['PPP', 'A', 'X'],
    segment: 'stable',
    stockUnits: 12,
    dailySales: 1.2,
    daysOfStock: 10,
    revenue: 17725,
  },
  {
    id: '2',
    name: 'Набор органайзеров',
    barcode: 'AHMA1OR501TR',
    channel: 'WB',
    tags: ['PP', 'B', 'X'],
    segment: 'stable',
    stockUnits: 4,
    dailySales: 0.8,
    daysOfStock: 5,
    revenue: 6210,
  },
  {
    id: '3',
    name: 'Шар мфр для пилатеса',
    barcode: 'ACRM2MS302BL',
    channel: 'OZON',
    tags: ['PP', 'B', 'Y'],
    segment: 'medium',
    stockUnits: 3,
    dailySales: 1.5,
    daysOfStock: 2,
    revenue: 8120,
  },
  {
    id: '4',
    name: 'Бандаж для лица прозрачный',
    barcode: 'ACRF1BN202CL',
    channel: 'OZON',
    tags: ['PP', 'B', 'Y'],
    segment: 'medium',
    stockUnits: 2,
    dailySales: 0.9,
    daysOfStock: 2,
    revenue: 7430,
  },
  {
    id: '5',
    name: 'Большой мешок для стирки',
    barcode: 'AHMA1BW101WH',
    channel: 'WB',
    tags: ['PPP', 'A', 'Y'],
    segment: 'medium',
    stockUnits: 24,
    dailySales: 2.2,
    daysOfStock: 11,
    revenue: 12380,
  },
  {
    id: '6',
    name: 'Таблетница на неделю',
    barcode: 'ACRA7TB301GR',
    channel: 'WB',
    tags: ['PPP', 'A', 'Z'],
    segment: 'unstable',
    stockUnits: 0,
    dailySales: 0.03,
    daysOfStock: 0,
    revenue: 14478,
  },
  {
    id: '7',
    name: 'Бандаж для лица подбородка многоразовый',
    barcode: 'ACRF1BN201GR',
    channel: 'WB',
    tags: ['PPP', 'A', 'Z'],
    segment: 'unstable',
    stockUnits: 8,
    dailySales: 0.5,
    daysOfStock: 16,
    revenue: 17431,
  },
  {
    id: '8',
    name: 'Подставка для планшета',
    barcode: 'ACRA1ST201BL',
    channel: 'OZON',
    tags: ['P', 'C', 'X'],
    segment: 'stable',
    stockUnits: 2,
    dailySales: 0.4,
    daysOfStock: 5,
    revenue: 2890,
  },
  {
    id: '9',
    name: 'Кольцо для пилатеса мягкое',
    barcode: 'ACRP1RG301GR',
    channel: 'WB',
    tags: ['P', 'C', 'X'],
    segment: 'stable',
    stockUnits: 5,
    dailySales: 0.4,
    daysOfStock: 12,
    revenue: 2410,
  },
  {
    id: '10',
    name: 'Карандаш с ластиком',
    barcode: 'ACPN1RC101BL',
    channel: 'WB',
    tags: ['P', 'C', 'Z'],
    segment: 'unstable',
    stockUnits: 15,
    dailySales: 0.07,
    daysOfStock: 214,
    revenue: 980,
  },
  {
    id: '11',
    name: 'Резиновый массажер для стоп',
    barcode: 'ACRM3RB201BL',
    channel: 'OZON',
    tags: ['-P', 'C', 'Z'],
    segment: 'unstable',
    stockUnits: 18,
    dailySales: 0.03,
    daysOfStock: 600,
    revenue: 420,
  },
  {
    id: '12',
    name: 'Мешок для стирки сетка',
    barcode: 'ACRF1MS301WH',
    channel: 'WB',
    tags: ['PPP', 'A', 'Y'],
    segment: 'medium',
    stockUnits: 0,
    dailySales: 1.4,
    daysOfStock: 0,
    revenue: 17390,
  },
];
