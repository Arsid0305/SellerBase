import type { ProductDetail } from './types';

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

function datesLast30(): string[] {
  const today = new Date('2026-06-02T00:00:00Z');
  const out: string[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(today.getUTCDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

export function buildProductDetailById(id: string): ProductDetail {
  const dates = datesLast30();
  const revenue = buildSeries(13, 12000, 5000);
  const orders = buildSeries(31, 22, 12);
  const stock = buildSeries(57, 480, 60);
  const transit = buildSeries(81, 120, 40);

  return {
    id,
    name: 'Крем-спрей для волос PERFECT HAIR многофункциональный 15 в 1 несмываемый, 250 мл',
    channel: 'WB',
    tags: ['PPP', 'A', 'Y'],
    meta: {
      brand: 'OllinProfessional',
      type: 'Склад Wildberries (FBO)',
      supplierCode: 'НАЛГООБЛ. ООО',
      wbCode: '60498968',
      barcode: id,
      inStock: true,
      inStockSince: '17.04.2025',
      rating: 4.8,
      reviewsCount: 1052,
    },
    sales: {
      price: 829,
      priceWithoutDiscount: 1990,
      orders: 142,
      delivered: 138,
      bought: 127,
      returns: 11,
      buyoutRate: 89.4,
      daysSinceLastOrder: 0,
      daysOfStock: 80,
      turnoverDays: 90,
    },
    finance: {
      revenue: 111_468,
      expenses: 84_590,
      profit: 26_878,
      profitability: 24.1,
      marketingExpenses: 8_240,
      revenueTrend: -38,
      lostRevenue: 8_240,
    },
    expenses: {
      wbCommission: 22_180,
      wbLogistics: 10_958,
      wbPenalties: 0,
      acquiring: 4_127,
      storage: 1_894,
      cost: 45_431,
    },
    warehouses: [
      { name: 'Хоругвино (RTM)', units: 102, inTransit: 14, daysOfStock: 22 },
      { name: 'Казань (140)', units: 80, inTransit: 38, daysOfStock: 18 },
      { name: 'Сарапул', units: 28, inTransit: 0, daysOfStock: 12 },
    ],
    revenueByDay: dates.map((d, i) => ({
      date: d,
      revenue: revenue[i] ?? 0,
      orders: orders[i] ?? 0,
    })),
    stockByDay: dates.map((d, i) => ({
      date: d,
      stock: stock[i] ?? 0,
      inTransit: transit[i] ?? 0,
    })),
  };
}
