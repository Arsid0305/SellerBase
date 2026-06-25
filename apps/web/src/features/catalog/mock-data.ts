import type { CatalogProduct, CatalogSummary } from './types';

function pseudoRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function sparkline(seed: number, base: number, jitter: number): number[] {
  const rand = pseudoRandom(seed);
  const out: number[] = [];
  for (let i = 0; i < 30; i++) {
    const noise = (rand() - 0.5) * jitter;
    const drift = Math.sin(i / 4) * (jitter / 3);
    out.push(Math.max(0, Math.round(base + noise + drift)));
  }
  return out;
}

export const mockCatalog: CatalogProduct[] = [
  {
    id: '1', name: 'Мяч массажный для стоп — шар мфр', barcode: 'ACRB1MS106WH',
    channel: 'WB', brand: 'Arols', category: 'Спорт / Фитнес',
    tags: ['PPP', 'A', 'Y'], stock: 12, inTransit: 8, warehousesCount: 3,
    sales30dRub: 17725, sales30dUnits: 30, margin: 38.2, cost: 380, price: 590,
    lastSaleDaysAgo: 0, daysOfStock: 10, salesSparkline: sparkline(13, 600, 320), visibility: 70, trust: 60, value: 50,
  },
  {
    id: '2', name: 'Бандаж для лица подбородка силиконовый', barcode: 'ACRF1BN201GR',
    channel: 'WB', brand: 'Arols', category: 'Красота / Уход',
    tags: ['PPP', 'A', 'Z'], stock: 8, inTransit: 20, warehousesCount: 2,
    sales30dRub: 17431, sales30dUnits: 16, margin: 41.5, cost: 420, price: 1089,
    lastSaleDaysAgo: 1, daysOfStock: 16, salesSparkline: sparkline(31, 580, 280), visibility: 70, trust: 60, value: 50,
  },
  {
    id: '3', name: 'Таблетница на неделю 2 приема круглая серая', barcode: 'ACRA7TB301GR',
    channel: 'WB', brand: 'Arols', category: 'Аптека',
    tags: ['PPP', 'A', 'Z'], stock: 0, inTransit: 50, warehousesCount: 3,
    sales30dRub: 14478, sales30dUnits: 21, margin: 33.0, cost: 240, price: 689,
    lastSaleDaysAgo: 0, daysOfStock: 0, salesSparkline: sparkline(57, 480, 240), visibility: 70, trust: 60, value: 50,
  },
  {
    id: '4', name: 'Большой мешок для стирки 60×80 сетка', barcode: 'AHMA1BW101WH',
    channel: 'WB', brand: 'HomeAids', category: 'Дом / Стирка',
    tags: ['PPP', 'A', 'Y'], stock: 24, inTransit: 0, warehousesCount: 2,
    sales30dRub: 12380, sales30dUnits: 19, margin: 37.2, cost: 310, price: 651,
    lastSaleDaysAgo: 0, daysOfStock: 38, salesSparkline: sparkline(81, 410, 200), visibility: 70, trust: 60, value: 50,
  },
  {
    id: '5', name: 'Мешок для стирки белья — сетка крупная — 3 штуки', barcode: 'AHMA3BW202WH',
    channel: 'WB', brand: 'HomeAids', category: 'Дом / Стирка',
    tags: ['PPP', 'A', 'Y'], stock: 0, inTransit: 12, warehousesCount: 1,
    sales30dRub: 17390, sales30dUnits: 22, margin: 35.8, cost: 290, price: 790,
    lastSaleDaysAgo: 0, daysOfStock: 0, salesSparkline: sparkline(101, 590, 260), visibility: 70, trust: 60, value: 50,
  },
  {
    id: '6', name: 'Шар мфр для пилатеса фитнес', barcode: 'ACRM2MS302BL',
    channel: 'OZON', brand: 'Arols', category: 'Спорт / Фитнес',
    tags: ['PP', 'B', 'Y'], stock: 3, inTransit: 5, warehousesCount: 1,
    sales30dRub: 8120, sales30dUnits: 11, margin: 28.4, cost: 410, price: 738,
    lastSaleDaysAgo: 2, daysOfStock: 8, salesSparkline: sparkline(127, 290, 180), visibility: 70, trust: 60, value: 50,
  },
  {
    id: '7', name: 'Бандаж для лица прозрачный', barcode: 'ACRF1BN202CL',
    channel: 'OZON', brand: 'Arols', category: 'Красота / Уход',
    tags: ['PP', 'B', 'Y'], stock: 2, inTransit: 8, warehousesCount: 1,
    sales30dRub: 7430, sales30dUnits: 9, margin: 31.2, cost: 440, price: 826,
    lastSaleDaysAgo: 3, daysOfStock: 7, salesSparkline: sparkline(149, 260, 160), visibility: 70, trust: 60, value: 50,
  },
  {
    id: '8', name: 'Набор органайзеров прозрачных', barcode: 'AHMA1OR501TR',
    channel: 'WB', brand: 'HomeAids', category: 'Дом / Хранение',
    tags: ['PP', 'B', 'X'], stock: 4, inTransit: 3, warehousesCount: 1,
    sales30dRub: 6210, sales30dUnits: 8, margin: 26.8, cost: 260, price: 776,
    lastSaleDaysAgo: 1, daysOfStock: 15, salesSparkline: sparkline(173, 220, 120), visibility: 70, trust: 60, value: 50,
  },
  {
    id: '9', name: 'Подставка для планшета регулируемая', barcode: 'ACRA1ST201BL',
    channel: 'OZON', brand: 'Arols', category: 'Электроника',
    tags: ['P', 'C', 'X'], stock: 2, inTransit: 0, warehousesCount: 1,
    sales30dRub: 2890, sales30dUnits: 3, margin: 15.2, cost: 320, price: 963,
    lastSaleDaysAgo: 6, daysOfStock: 20, salesSparkline: sparkline(193, 95, 60), visibility: 70, trust: 60, value: 50,
  },
  {
    id: '10', name: 'Кольцо для пилатеса мягкое', barcode: 'ACRP1RG301GR',
    channel: 'WB', brand: 'Arols', category: 'Спорт / Фитнес',
    tags: ['P', 'C', 'X'], stock: 5, inTransit: 0, warehousesCount: 1,
    sales30dRub: 2410, sales30dUnits: 4, margin: 18.0, cost: 280, price: 603,
    lastSaleDaysAgo: 5, daysOfStock: 38, salesSparkline: sparkline(211, 80, 50), visibility: 70, trust: 60, value: 50,
  },
  {
    id: '11', name: 'Карандаш с ластиком набор', barcode: 'ACPN1RC101BL',
    channel: 'WB', brand: 'Arols', category: 'Канцелярия',
    tags: ['P', 'C', 'Z'], stock: 15, inTransit: 0, warehousesCount: 1,
    sales30dRub: 980, sales30dUnits: 2, margin: 12.4, cost: 95, price: 490,
    lastSaleDaysAgo: 12, daysOfStock: 214, salesSparkline: sparkline(233, 35, 40), visibility: 70, trust: 60, value: 50,
  },
  {
    id: '12', name: 'Резиновый массажер для стоп', barcode: 'ACRM3RB201BL',
    channel: 'OZON', brand: 'Arols', category: 'Спорт / Фитнес',
    tags: ['-P', 'C', 'Z'], stock: 18, inTransit: 0, warehousesCount: 1,
    sales30dRub: 420, sales30dUnits: 1, margin: -8.5, cost: 380, price: 420,
    lastSaleDaysAgo: 22, daysOfStock: 600, salesSparkline: sparkline(257, 15, 25), visibility: 70, trust: 60, value: 50,
  },
  {
    id: '13', name: 'Штопор винный автоматический', barcode: 'AHMA1WO101GR',
    channel: 'WB', brand: 'HomeAids', category: 'Дом / Кухня',
    tags: ['PP', 'A', 'Y'], stock: 42, inTransit: 15, warehousesCount: 2,
    sales30dRub: 9840, sales30dUnits: 12, margin: 29.1, cost: 380, price: 820,
    lastSaleDaysAgo: 0, daysOfStock: 105, salesSparkline: sparkline(283, 340, 180), visibility: 70, trust: 60, value: 50,
  },
  {
    id: '14', name: 'Чехол для AirPods прозрачный silicone', barcode: 'ACRA1AP201CL',
    channel: 'OZON', brand: 'Arols', category: 'Электроника',
    tags: ['PP', 'B', 'Y'], stock: 7, inTransit: 0, warehousesCount: 1,
    sales30dRub: 5640, sales30dUnits: 7, margin: 22.8, cost: 195, price: 806,
    lastSaleDaysAgo: 4, daysOfStock: 30, salesSparkline: sparkline(311, 200, 140), visibility: 70, trust: 60, value: 50,
  },
  {
    id: '15', name: 'Набор вешалок пластиковых 24 штуки', barcode: 'AHMA1HH101WH',
    channel: 'WB', brand: 'HomeAids', category: 'Дом / Гардероб',
    tags: ['PPP', 'A', 'X'], stock: 28, inTransit: 60, warehousesCount: 3,
    sales30dRub: 15890, sales30dUnits: 24, margin: 39.5, cost: 280, price: 663,
    lastSaleDaysAgo: 0, daysOfStock: 35, salesSparkline: sparkline(337, 530, 250), visibility: 70, trust: 60, value: 50,
  },
  {
    id: '16', name: 'Коврик для мыши расширенный 80×30', barcode: 'ACRA1MM801BL',
    channel: 'WB', brand: 'Arols', category: 'Электроника',
    tags: ['PP', 'B', 'X'], stock: 11, inTransit: 0, warehousesCount: 1,
    sales30dRub: 4720, sales30dUnits: 6, margin: 25.4, cost: 220, price: 787,
    lastSaleDaysAgo: 2, daysOfStock: 55, salesSparkline: sparkline(367, 165, 100), visibility: 70, trust: 60, value: 50,
  },
  {
    id: '17', name: 'Свечи ароматические набор 3 шт', barcode: 'AHMA1CN301WH',
    channel: 'OZON', brand: 'HomeAids', category: 'Дом / Декор',
    tags: ['P', 'B', 'Z'], stock: 6, inTransit: 0, warehousesCount: 1,
    sales30dRub: 3210, sales30dUnits: 5, margin: 19.6, cost: 290, price: 642,
    lastSaleDaysAgo: 8, daysOfStock: 36, salesSparkline: sparkline(389, 115, 90), visibility: 70, trust: 60, value: 50,
  },
  {
    id: '18', name: 'Йога-коврик толстый нескользящий', barcode: 'ACRA1YM501BL',
    channel: 'WB', brand: 'Arols', category: 'Спорт / Йога',
    tags: ['PP', 'A', 'Y'], stock: 19, inTransit: 30, warehousesCount: 2,
    sales30dRub: 13560, sales30dUnits: 11, margin: 34.7, cost: 520, price: 1233,
    lastSaleDaysAgo: 0, daysOfStock: 52, salesSparkline: sparkline(419, 460, 220), visibility: 70, trust: 60, value: 50,
  },
  {
    id: '19', name: 'Спинер антистресс металлический', barcode: 'ACRA1SP201SI',
    channel: 'WB', brand: 'Arols', category: 'Игрушки',
    tags: ['P', 'C', 'Z'], stock: 32, inTransit: 0, warehousesCount: 1,
    sales30dRub: 1280, sales30dUnits: 3, margin: 14.0, cost: 110, price: 427,
    lastSaleDaysAgo: 15, daysOfStock: 320, salesSparkline: sparkline(443, 45, 50), visibility: 70, trust: 60, value: 50,
  },
  {
    id: '20', name: 'Опора для ноутбука алюминиевая', barcode: 'ACRA1LS101SI',
    channel: 'OZON', brand: 'Arols', category: 'Электроника',
    tags: ['PP', 'B', 'Y'], stock: 9, inTransit: 4, warehousesCount: 1,
    sales30dRub: 8240, sales30dUnits: 6, margin: 27.5, cost: 580, price: 1373,
    lastSaleDaysAgo: 1, daysOfStock: 45, salesSparkline: sparkline(463, 285, 150), visibility: 70, trust: 60, value: 50,
  },
  {
    id: '21', name: 'Набор крючков самоклеящихся 10 шт', barcode: 'AHMA1HK101WH',
    channel: 'WB', brand: 'HomeAids', category: 'Дом / Гардероб',
    tags: ['P', 'C', 'X'], stock: 14, inTransit: 0, warehousesCount: 1,
    sales30dRub: 2890, sales30dUnits: 7, margin: 21.0, cost: 120, price: 413,
    lastSaleDaysAgo: 3, daysOfStock: 60, salesSparkline: sparkline(487, 100, 70), visibility: 70, trust: 60, value: 50,
  },
  {
    id: '22', name: 'Подушка для путешествий надувная', barcode: 'AHMA1TP101GR',
    channel: 'WB', brand: 'HomeAids', category: 'Путешествия',
    tags: ['PP', 'B', 'Y'], stock: 0, inTransit: 25, warehousesCount: 1,
    sales30dRub: 5680, sales30dUnits: 9, margin: 30.2, cost: 230, price: 631,
    lastSaleDaysAgo: 0, daysOfStock: 0, salesSparkline: sparkline(509, 200, 130), visibility: 70, trust: 60, value: 50,
  },
  {
    id: '23', name: 'Лента резиновая фитнес набор 3 плотности', barcode: 'ACRA1FB301YE',
    channel: 'OZON', brand: 'Arols', category: 'Спорт / Фитнес',
    tags: ['PP', 'A', 'X'], stock: 21, inTransit: 0, warehousesCount: 2,
    sales30dRub: 11340, sales30dUnits: 9, margin: 32.8, cost: 380, price: 1260,
    lastSaleDaysAgo: 0, daysOfStock: 70, salesSparkline: sparkline(541, 400, 200), visibility: 70, trust: 60, value: 50,
  },
  {
    id: '24', name: 'Щётка для обуви автоматическая', barcode: 'AHMA1SC101BL',
    channel: 'WB', brand: 'HomeAids', category: 'Дом / Уборка',
    tags: ['P', 'C', 'Z'], stock: 8, inTransit: 0, warehousesCount: 1,
    sales30dRub: 1680, sales30dUnits: 2, margin: 13.5, cost: 380, price: 840,
    lastSaleDaysAgo: 18, daysOfStock: 120, salesSparkline: sparkline(563, 60, 60), visibility: 70, trust: 60, value: 50,
  },
  {
    id: '25', name: 'Ароматизатор для авто миниатюрный', barcode: 'ACRA1CA101BL',
    channel: 'OZON', brand: 'Arols', category: 'Авто',
    tags: ['P', 'B', 'Z'], stock: 11, inTransit: 0, warehousesCount: 1,
    sales30dRub: 4520, sales30dUnits: 8, margin: 24.6, cost: 95, price: 565,
    lastSaleDaysAgo: 3, daysOfStock: 41, salesSparkline: sparkline(587, 160, 110), visibility: 70, trust: 60, value: 50,
  },
];

export function buildCatalogSummary(rows: CatalogProduct[]): CatalogSummary {
  const inStock = rows.filter((r) => r.stock > 0).length;
  const outOfStock = rows.length - inStock;
  const noSales30d = rows.filter((r) => r.sales30dUnits === 0 || r.lastSaleDaysAgo > 14).length;
  const excess = rows.filter((r) => r.daysOfStock > 90).length;
  const totalSales = rows.reduce((acc, r) => acc + r.sales30dRub, 0);
  // Средняя маржа = взвешенная по выручке: sum(profit) / sum(revenue) × 100.
  // Не простое среднее процентов — те бы дали скошенный результат если у одного SKU
  // маржа 100% и нет продаж, а у остальных 15% с большой выручкой.
  // Источник margin: 0-100 (проценты). Учитываем только SKU с положительной выручкой.
  const totalProfit = rows.reduce((acc, r) => {
    if (r.sales30dRub > 0) return acc + (r.sales30dRub * r.margin) / 100;
    return acc;
  }, 0);
  return {
    totalCount: rows.length,
    inStock,
    outOfStock,
    noSales30d,
    excessCount: excess,
    totalSales30dRub: totalSales,
    avgMargin: totalSales > 0 ? (totalProfit / totalSales) * 100 : 0,
  };
}
