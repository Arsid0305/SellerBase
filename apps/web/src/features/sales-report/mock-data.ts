import type { SalesGrouping, SalesReportRow, SalesSummary } from './types';

function pseudoRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function buildDayRows(): SalesReportRow[] {
  const rand = pseudoRandom(101);
  const today = new Date('2026-06-02T00:00:00Z');
  const rows: SalesReportRow[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(today.getUTCDate() - i);
    const orders = Math.max(1, Math.round(15 + (rand() - 0.5) * 18));
    const unitsSold = orders + Math.round(rand() * 6);
    const avgCheck = Math.round(650 + (rand() - 0.5) * 280);
    const revenue = orders * avgCheck;
    const cancellations = Math.round(orders * (0.03 + rand() * 0.08));
    rows.push({
      key: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' }),
      sublabel: d.toLocaleDateString('ru-RU', { weekday: 'short' }),
      orders,
      unitsSold,
      revenue,
      avgCheck,
      cancellations,
      cancelRate: (cancellations / orders) * 100,
    });
  }
  return rows;
}

function buildWeekRows(): SalesReportRow[] {
  const days = buildDayRows();
  const weeks: Record<string, SalesReportRow> = {};
  days.forEach((d, idx) => {
    const weekKey = `Неделя ${Math.floor(idx / 7) + 1}`;
    if (!weeks[weekKey]) {
      weeks[weekKey] = {
        key: weekKey,
        label: weekKey,
        orders: 0,
        unitsSold: 0,
        revenue: 0,
        avgCheck: 0,
        cancellations: 0,
        cancelRate: 0,
      };
    }
    const w = weeks[weekKey];
    if (!w) return;
    w.orders += d.orders;
    w.unitsSold += d.unitsSold;
    w.revenue += d.revenue;
    w.cancellations += d.cancellations;
  });
  return Object.values(weeks).map((w) => ({
    ...w,
    avgCheck: w.orders > 0 ? Math.round(w.revenue / w.orders) : 0,
    cancelRate: w.orders > 0 ? (w.cancellations / w.orders) * 100 : 0,
  }));
}

function buildMonthRows(): SalesReportRow[] {
  return [
    {
      key: '2026-04',
      label: 'Апрель 2026',
      orders: 720,
      unitsSold: 968,
      revenue: 560_312,
      avgCheck: 778,
      cancellations: 41,
      cancelRate: 5.7,
    },
    {
      key: '2026-05',
      label: 'Май 2026',
      orders: 612,
      unitsSold: 819,
      revenue: 482_705,
      avgCheck: 789,
      cancellations: 37,
      cancelRate: 6.0,
    },
    {
      key: '2026-06',
      label: 'Июнь 2026 (частично)',
      orders: 28,
      unitsSold: 41,
      revenue: 22_180,
      avgCheck: 792,
      cancellations: 2,
      cancelRate: 7.1,
    },
  ];
}

function buildChannelRows(): SalesReportRow[] {
  return [
    {
      key: 'WB',
      label: 'Wildberries',
      sublabel: 'Основной канал',
      orders: 1080,
      unitsSold: 1452,
      revenue: 850_487,
      avgCheck: 787,
      cancellations: 54,
      cancelRate: 5.0,
    },
    {
      key: 'OZON',
      label: 'Ozon',
      sublabel: 'Доп. канал',
      orders: 280,
      unitsSold: 376,
      revenue: 214_710,
      avgCheck: 767,
      cancellations: 26,
      cancelRate: 9.3,
    },
  ];
}

function buildProductRows(): SalesReportRow[] {
  return [
    {
      key: 'ACRB1MS106WH',
      label: 'Мяч массажный для стоп',
      sublabel: 'ACRB1MS106WH',
      orders: 30,
      unitsSold: 30,
      revenue: 17725,
      avgCheck: 591,
      cancellations: 1,
      cancelRate: 3.3,
    },
    {
      key: 'ACRF1BN201GR',
      label: 'Бандаж для лица подбородка',
      sublabel: 'ACRF1BN201GR',
      orders: 16,
      unitsSold: 16,
      revenue: 17431,
      avgCheck: 1089,
      cancellations: 0,
      cancelRate: 0,
    },
    {
      key: 'AHMA3BW202WH',
      label: 'Мешок для стирки белья — 3 штуки',
      sublabel: 'AHMA3BW202WH',
      orders: 22,
      unitsSold: 22,
      revenue: 17390,
      avgCheck: 790,
      cancellations: 2,
      cancelRate: 9.1,
    },
    {
      key: 'ACRA7TB301GR',
      label: 'Таблетница на неделю круглая серая',
      sublabel: 'ACRA7TB301GR',
      orders: 21,
      unitsSold: 21,
      revenue: 14478,
      avgCheck: 689,
      cancellations: 1,
      cancelRate: 4.8,
    },
    {
      key: 'AHMA1BW101WH',
      label: 'Большой мешок для стирки 60×80',
      sublabel: 'AHMA1BW101WH',
      orders: 19,
      unitsSold: 19,
      revenue: 12380,
      avgCheck: 651,
      cancellations: 1,
      cancelRate: 5.3,
    },
    {
      key: 'ACRM2MS302BL',
      label: 'Шар мфр для пилатеса',
      sublabel: 'ACRM2MS302BL',
      orders: 11,
      unitsSold: 11,
      revenue: 8120,
      avgCheck: 738,
      cancellations: 1,
      cancelRate: 9.1,
    },
  ];
}

export function rowsForGrouping(grouping: SalesGrouping): SalesReportRow[] {
  switch (grouping) {
    case 'day':
      return buildDayRows();
    case 'week':
      return buildWeekRows();
    case 'month':
      return buildMonthRows();
    case 'channel':
      return buildChannelRows();
    case 'product':
      return buildProductRows();
  }
}

export function buildSalesSummary(rows: SalesReportRow[]): SalesSummary {
  const totalOrders = rows.reduce((acc, r) => acc + r.orders, 0);
  const totalRevenue = rows.reduce((acc, r) => acc + r.revenue, 0);
  const totalCancellations = rows.reduce((acc, r) => acc + r.cancellations, 0);
  return {
    totalOrders,
    totalUnits: rows.reduce((acc, r) => acc + r.unitsSold, 0),
    totalRevenue,
    avgCheck: totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0,
    cancellationRate: totalOrders > 0 ? (totalCancellations / totalOrders) * 100 : 0,
  };
}
