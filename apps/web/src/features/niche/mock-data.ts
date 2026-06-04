import type { NicheBrand, NicheCategory, NicheKpis, SearchQuery } from './types';

function spark(base: number, len: number, vol = 0.18): number[] {
  const out: number[] = [];
  let v = base;
  for (let i = 0; i < len; i++) {
    const drift = (Math.sin(i * 1.3 + base) + Math.cos(i * 0.7)) * vol;
    v = Math.max(1, base * (1 + drift * 0.4 + (i / len - 0.5) * 0.2));
    out.push(Math.round(v));
  }
  return out;
}

export const mockCategories: NicheCategory[] = [
  { id: 'c1', name: 'Спорт / Фитнес', sellersCount: 4820, productsCount: 38400, monthlyRevenue: 1_240_000_000, avgPrice: 1890, topBrandShare: 12.4, competitiveness: 7.8, trend30d: spark(120, 30) },
  { id: 'c2', name: 'Дом / Стирка', sellersCount: 2310, productsCount: 14200, monthlyRevenue: 680_000_000, avgPrice: 740, topBrandShare: 18.1, competitiveness: 5.4, trend30d: spark(80, 30) },
  { id: 'c3', name: 'Красота / Уход', sellersCount: 9420, productsCount: 96100, monthlyRevenue: 3_180_000_000, avgPrice: 1240, topBrandShare: 8.9, competitiveness: 9.1, trend30d: spark(240, 30) },
  { id: 'c4', name: 'Электроника', sellersCount: 5610, productsCount: 51200, monthlyRevenue: 2_910_000_000, avgPrice: 4380, topBrandShare: 22.5, competitiveness: 8.4, trend30d: spark(190, 30) },
  { id: 'c5', name: 'Канцелярия', sellersCount: 1840, productsCount: 22300, monthlyRevenue: 410_000_000, avgPrice: 320, topBrandShare: 14.6, competitiveness: 4.2, trend30d: spark(60, 30) },
  { id: 'c6', name: 'Аптека', sellersCount: 1290, productsCount: 9800, monthlyRevenue: 540_000_000, avgPrice: 690, topBrandShare: 26.3, competitiveness: 3.6, trend30d: spark(70, 30) },
  { id: 'c7', name: 'Авто', sellersCount: 3140, productsCount: 28600, monthlyRevenue: 980_000_000, avgPrice: 2140, topBrandShare: 11.2, competitiveness: 6.5, trend30d: spark(110, 30) },
  { id: 'c8', name: 'Дом / Кухня', sellersCount: 6780, productsCount: 62400, monthlyRevenue: 1_780_000_000, avgPrice: 1480, topBrandShare: 9.7, competitiveness: 8.6, trend30d: spark(160, 30) },
  { id: 'c9', name: 'Игрушки', sellersCount: 2960, productsCount: 31900, monthlyRevenue: 720_000_000, avgPrice: 890, topBrandShare: 13.5, competitiveness: 6.9, trend30d: spark(90, 30) },
  { id: 'c10', name: 'Сад / Огород', sellersCount: 1620, productsCount: 13700, monthlyRevenue: 320_000_000, avgPrice: 540, topBrandShare: 16.8, competitiveness: 3.9, trend30d: spark(50, 30) },
  { id: 'c11', name: 'Одежда', sellersCount: 14820, productsCount: 184000, monthlyRevenue: 5_640_000_000, avgPrice: 1980, topBrandShare: 5.4, competitiveness: 9.6, trend30d: spark(380, 30) },
  { id: 'c12', name: 'Обувь', sellersCount: 7240, productsCount: 71200, monthlyRevenue: 2_410_000_000, avgPrice: 2480, topBrandShare: 7.8, competitiveness: 8.9, trend30d: spark(220, 30) },
  { id: 'c13', name: 'Зоотовары', sellersCount: 1980, productsCount: 16800, monthlyRevenue: 590_000_000, avgPrice: 680, topBrandShare: 19.4, competitiveness: 5.1, trend30d: spark(75, 30) },
  { id: 'c14', name: 'Книги', sellersCount: 940, productsCount: 8600, monthlyRevenue: 180_000_000, avgPrice: 480, topBrandShare: 31.2, competitiveness: 2.8, trend30d: spark(30, 30) },
  { id: 'c15', name: 'Ювелирные изделия', sellersCount: 1450, productsCount: 11400, monthlyRevenue: 860_000_000, avgPrice: 5240, topBrandShare: 12.1, competitiveness: 6.2, trend30d: spark(95, 30) },
];

export const mockBrands: NicheBrand[] = [
  { id: 'b1', name: 'Arols', productsCount: 320, monthlyRevenue: 184_000_000, avgRating: 4.7, topCategory: 'Красота / Уход', marketShare: 5.8 },
  { id: 'b2', name: 'HomeAids', productsCount: 540, monthlyRevenue: 142_000_000, avgRating: 4.6, topCategory: 'Дом / Кухня', marketShare: 4.1 },
  { id: 'b3', name: 'Nordic', productsCount: 210, monthlyRevenue: 96_000_000, avgRating: 4.8, topCategory: 'Дом / Стирка', marketShare: 14.1 },
  { id: 'b4', name: 'ProSport', productsCount: 480, monthlyRevenue: 154_000_000, avgRating: 4.5, topCategory: 'Спорт / Фитнес', marketShare: 12.4 },
  { id: 'b5', name: 'Lumitech', productsCount: 280, monthlyRevenue: 268_000_000, avgRating: 4.4, topCategory: 'Электроника', marketShare: 9.2 },
  { id: 'b6', name: 'Avtokit', productsCount: 360, monthlyRevenue: 78_000_000, avgRating: 4.3, topCategory: 'Авто', marketShare: 8.0 },
  { id: 'b7', name: 'BabyJoy', productsCount: 410, monthlyRevenue: 64_000_000, avgRating: 4.7, topCategory: 'Игрушки', marketShare: 8.9 },
  { id: 'b8', name: 'PureSkin', productsCount: 180, monthlyRevenue: 138_000_000, avgRating: 4.8, topCategory: 'Красота / Уход', marketShare: 4.3 },
  { id: 'b9', name: 'GreenSad', productsCount: 240, monthlyRevenue: 38_000_000, avgRating: 4.6, topCategory: 'Сад / Огород', marketShare: 11.9 },
  { id: 'b10', name: 'PharmaPlus', productsCount: 320, monthlyRevenue: 112_000_000, avgRating: 4.7, topCategory: 'Аптека', marketShare: 20.7 },
  { id: 'b11', name: 'Vitalux', productsCount: 140, monthlyRevenue: 86_000_000, avgRating: 4.6, topCategory: 'Аптека', marketShare: 15.9 },
  { id: 'b12', name: 'Trendlook', productsCount: 720, monthlyRevenue: 246_000_000, avgRating: 4.2, topCategory: 'Одежда', marketShare: 4.4 },
  { id: 'b13', name: 'StepUp', productsCount: 380, monthlyRevenue: 168_000_000, avgRating: 4.4, topCategory: 'Обувь', marketShare: 7.0 },
  { id: 'b14', name: 'PetCare', productsCount: 290, monthlyRevenue: 92_000_000, avgRating: 4.7, topCategory: 'Зоотовары', marketShare: 15.6 },
  { id: 'b15', name: 'OfficeMate', productsCount: 410, monthlyRevenue: 54_000_000, avgRating: 4.5, topCategory: 'Канцелярия', marketShare: 13.2 },
  { id: 'b16', name: 'Goldline', productsCount: 160, monthlyRevenue: 108_000_000, avgRating: 4.8, topCategory: 'Ювелирные изделия', marketShare: 12.6 },
  { id: 'b17', name: 'BookHaus', productsCount: 220, monthlyRevenue: 32_000_000, avgRating: 4.9, topCategory: 'Книги', marketShare: 17.8 },
  { id: 'b18', name: 'FitMax', productsCount: 260, monthlyRevenue: 112_000_000, avgRating: 4.5, topCategory: 'Спорт / Фитнес', marketShare: 9.0 },
  { id: 'b19', name: 'KitchenPro', productsCount: 340, monthlyRevenue: 128_000_000, avgRating: 4.4, topCategory: 'Дом / Кухня', marketShare: 7.2 },
  { id: 'b20', name: 'SmartGear', productsCount: 190, monthlyRevenue: 198_000_000, avgRating: 4.5, topCategory: 'Электроника', marketShare: 6.8 },
];

export const mockQueries: SearchQuery[] = [
  { id: 'q1', text: 'мяч массажный', frequency: 18400, competitorCount: 2840, avgCpc: 24, trend7d: spark(180, 7) },
  { id: 'q2', text: 'крем для лица', frequency: 96200, competitorCount: 14800, avgCpc: 62, trend7d: spark(960, 7) },
  { id: 'q3', text: 'массажер для стоп', frequency: 7200, competitorCount: 1240, avgCpc: 38, trend7d: spark(70, 7) },
  { id: 'q4', text: 'бандаж для лица', frequency: 5400, competitorCount: 980, avgCpc: 41, trend7d: spark(54, 7) },
  { id: 'q5', text: 'таблетница на неделю', frequency: 3800, competitorCount: 640, avgCpc: 18, trend7d: spark(38, 7) },
  { id: 'q6', text: 'наушники беспроводные', frequency: 124000, competitorCount: 21200, avgCpc: 84, trend7d: spark(1240, 7) },
  { id: 'q7', text: 'термобелье мужское', frequency: 28400, competitorCount: 4200, avgCpc: 46, trend7d: spark(280, 7) },
  { id: 'q8', text: 'коврик для йоги', frequency: 21800, competitorCount: 3140, avgCpc: 32, trend7d: spark(220, 7) },
  { id: 'q9', text: 'шампунь для волос', frequency: 68400, competitorCount: 9800, avgCpc: 54, trend7d: spark(680, 7) },
  { id: 'q10', text: 'кроссовки женские', frequency: 184000, competitorCount: 28400, avgCpc: 96, trend7d: spark(1840, 7) },
  { id: 'q11', text: 'набор посуды', frequency: 16200, competitorCount: 2480, avgCpc: 38, trend7d: spark(160, 7) },
  { id: 'q12', text: 'детский конструктор', frequency: 22400, competitorCount: 3680, avgCpc: 34, trend7d: spark(220, 7) },
  { id: 'q13', text: 'витамины для женщин', frequency: 31200, competitorCount: 4920, avgCpc: 58, trend7d: spark(310, 7) },
  { id: 'q14', text: 'корм для кошек', frequency: 18800, competitorCount: 2240, avgCpc: 28, trend7d: spark(190, 7) },
  { id: 'q15', text: 'дрель аккумуляторная', frequency: 9800, competitorCount: 1480, avgCpc: 64, trend7d: spark(98, 7) },
  { id: 'q16', text: 'постельное белье евро', frequency: 24800, competitorCount: 3680, avgCpc: 42, trend7d: spark(248, 7) },
  { id: 'q17', text: 'термос', frequency: 14600, competitorCount: 2140, avgCpc: 30, trend7d: spark(146, 7) },
  { id: 'q18', text: 'тушь для ресниц', frequency: 42400, competitorCount: 6800, avgCpc: 48, trend7d: spark(420, 7) },
  { id: 'q19', text: 'рюкзак школьный', frequency: 19200, competitorCount: 2940, avgCpc: 38, trend7d: spark(190, 7) },
  { id: 'q20', text: 'портативная колонка', frequency: 32400, competitorCount: 4820, avgCpc: 72, trend7d: spark(320, 7) },
  { id: 'q21', text: 'парфюм женский', frequency: 54800, competitorCount: 8120, avgCpc: 78, trend7d: spark(540, 7) },
  { id: 'q22', text: 'лопата складная', frequency: 4200, competitorCount: 720, avgCpc: 22, trend7d: spark(42, 7) },
  { id: 'q23', text: 'ручка гелевая', frequency: 8400, competitorCount: 1320, avgCpc: 14, trend7d: spark(84, 7) },
  { id: 'q24', text: 'серьги серебро', frequency: 22600, competitorCount: 3480, avgCpc: 54, trend7d: spark(220, 7) },
  { id: 'q25', text: 'книга психология', frequency: 11400, competitorCount: 1840, avgCpc: 26, trend7d: spark(114, 7) },
];

export const mockNicheKpis: NicheKpis = {
  categoriesCount: mockCategories.length,
  brandsCount: mockBrands.length,
  productsCount: mockCategories.reduce((s, c) => s + c.productsCount, 0),
  avgCategoryRevenue: Math.round(
    mockCategories.reduce((s, c) => s + c.monthlyRevenue, 0) / mockCategories.length,
  ),
};
