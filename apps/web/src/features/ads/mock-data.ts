import type { AdCampaign, AdsKpis, PromotedProduct } from './types';

function sparkline(base: number, variance: number, len = 14): number[] {
  const out: number[] = [];
  let prev = base;
  for (let i = 0; i < len; i++) {
    const drift = (Math.sin(i * 1.3 + base) + Math.cos(i * 0.7)) * variance;
    const next = Math.max(0, Math.round(prev + drift));
    out.push(next);
    prev = (prev * 2 + next) / 3;
  }
  return out;
}

export const mockCampaigns: AdCampaign[] = [
  { id: 'c1', name: 'Авто — Все категории WB', type: 'auto', marketplace: 'WB', status: 'active', dailyBudget: 3500, cpc: 8.4, clicks: 12480, clicks14d: sparkline(900, 90), orders: 412, conversionRate: 3.3, spend: 104832, revenue: 612400, roas: 5.84 },
  { id: 'c2', name: 'Поиск — Бренд «Aurora»', type: 'search', marketplace: 'WB', status: 'active', dailyBudget: 2200, cpc: 11.2, clicks: 8430, clicks14d: sparkline(600, 70), orders: 218, conversionRate: 2.59, spend: 94416, revenue: 318200, roas: 3.37 },
  { id: 'c3', name: 'Карточка — Куртка зимняя женская', type: 'card', marketplace: 'WB', status: 'active', dailyBudget: 1800, cpc: 6.1, clicks: 5210, clicks14d: sparkline(380, 60), orders: 184, conversionRate: 3.53, spend: 31781, revenue: 215600, roas: 6.78 },
  { id: 'c4', name: 'Каталог — Обувь мужская', type: 'catalog', marketplace: 'OZON', status: 'active', dailyBudget: 4200, cpc: 14.8, clicks: 9340, clicks14d: sparkline(720, 100), orders: 142, conversionRate: 1.52, spend: 138232, revenue: 211400, roas: 1.53 },
  { id: 'c5', name: 'Поиск — Кроссовки nike', type: 'search', marketplace: 'OZON', status: 'active', dailyBudget: 5000, cpc: 22.4, clicks: 4120, clicks14d: sparkline(310, 50), orders: 51, conversionRate: 1.24, spend: 92288, revenue: 76200, roas: 0.83 },
  { id: 'c6', name: 'Авто — Электроника', type: 'auto', marketplace: 'OZON', status: 'paused', dailyBudget: 2800, cpc: 9.6, clicks: 3540, clicks14d: sparkline(220, 80), orders: 88, conversionRate: 2.49, spend: 33984, revenue: 142800, roas: 4.20 },
  { id: 'c7', name: 'Карточка — Чехол iPhone 15', type: 'card', marketplace: 'WB', status: 'active', dailyBudget: 600, cpc: 4.2, clicks: 2840, clicks14d: sparkline(200, 30), orders: 112, conversionRate: 3.94, spend: 11928, revenue: 89400, roas: 7.49 },
  { id: 'c8', name: 'Поиск — Косметика органик', type: 'search', marketplace: 'OZON', status: 'paused', dailyBudget: 1500, cpc: 7.8, clicks: 4220, clicks14d: sparkline(280, 50), orders: 95, conversionRate: 2.25, spend: 32916, revenue: 124600, roas: 3.79 },
  { id: 'c9', name: 'Каталог — Игрушки детские', type: 'catalog', marketplace: 'WB', status: 'paused', dailyBudget: 900, cpc: 5.4, clicks: 3210, clicks14d: sparkline(230, 40), orders: 78, conversionRate: 2.43, spend: 17334, revenue: 68200, roas: 3.94 },
  { id: 'c10', name: 'Авто — Кухня и посуда', type: 'auto', marketplace: 'WB', status: 'archived', dailyBudget: 1200, cpc: 6.8, clicks: 1980, clicks14d: sparkline(140, 30), orders: 41, conversionRate: 2.07, spend: 13464, revenue: 38200, roas: 2.84 },
  { id: 'c11', name: 'Поиск — Спорт-питание', type: 'search', marketplace: 'OZON', status: 'archived', dailyBudget: 700, cpc: 12.6, clicks: 1140, clicks14d: sparkline(80, 20), orders: 18, conversionRate: 1.58, spend: 14364, revenue: 22400, roas: 1.56 },
  { id: 'c12', name: 'Карточка — Тренажёр TRX', type: 'card', marketplace: 'WB', status: 'archived', dailyBudget: 250, cpc: 3.4, clicks: 820, clicks14d: sparkline(60, 15), orders: 24, conversionRate: 2.93, spend: 2788, revenue: 18600, roas: 6.67 },
];

export const mockPromotedProducts: PromotedProduct[] = [
  { id: 'p1', name: 'Куртка зимняя женская «Aurora»', barcode: '4607012345678', channel: 'WB', impressions: 412300, clicks: 8420, orders: 312, ctr: 2.04, cr: 3.71, spend: 51362, revenue: 412800, roas: 8.04 },
  { id: 'p2', name: 'Кроссовки беговые «Nike Pegasus»', barcode: '4607012345679', channel: 'OZON', impressions: 318400, clicks: 4120, orders: 51, ctr: 1.29, cr: 1.24, spend: 92288, revenue: 76200, roas: 0.83 },
  { id: 'p3', name: 'Чехол силиконовый iPhone 15 Pro', barcode: '4607012345680', channel: 'WB', impressions: 228100, clicks: 5840, orders: 218, ctr: 2.56, cr: 3.73, spend: 24528, revenue: 174400, roas: 7.11 },
  { id: 'p4', name: 'Платье летнее льняное', barcode: '4607012345681', channel: 'WB', impressions: 184200, clicks: 3210, orders: 124, ctr: 1.74, cr: 3.86, spend: 19260, revenue: 148800, roas: 7.73 },
  { id: 'p5', name: 'Кофемашина капсульная Krups', barcode: '4607012345682', channel: 'OZON', impressions: 142800, clicks: 1840, orders: 28, ctr: 1.29, cr: 1.52, spend: 27232, revenue: 112000, roas: 4.11 },
  { id: 'p6', name: 'Сумка кожаная женская', barcode: '4607012345683', channel: 'WB', impressions: 128400, clicks: 2940, orders: 88, ctr: 2.29, cr: 2.99, spend: 17640, revenue: 96800, roas: 5.49 },
  { id: 'p7', name: 'Робот-пылесос Xiaomi S10', barcode: '4607012345684', channel: 'OZON', impressions: 118200, clicks: 1620, orders: 22, ctr: 1.37, cr: 1.36, spend: 28080, revenue: 79200, roas: 2.82 },
  { id: 'p8', name: 'Кроссовки женские «Adidas Run»', barcode: '4607012345685', channel: 'WB', impressions: 98200, clicks: 2410, orders: 74, ctr: 2.45, cr: 3.07, spend: 14460, revenue: 88800, roas: 6.14 },
  { id: 'p9', name: 'Сковорода чугунная 26 см', barcode: '4607012345686', channel: 'OZON', impressions: 88400, clicks: 1240, orders: 38, ctr: 1.40, cr: 3.06, spend: 8680, revenue: 36100, roas: 4.16 },
  { id: 'p10', name: 'Косметичка органайзер', barcode: '4607012345687', channel: 'WB', impressions: 76200, clicks: 1820, orders: 64, ctr: 2.39, cr: 3.52, spend: 7644, revenue: 32000, roas: 4.19 },
  { id: 'p11', name: 'Шампунь органик «Natura Siberica»', barcode: '4607012345688', channel: 'OZON', impressions: 68400, clicks: 1320, orders: 42, ctr: 1.93, cr: 3.18, spend: 9636, revenue: 25200, roas: 2.61 },
  { id: 'p12', name: 'Игрушка мягкая «Медведь»', barcode: '4607012345689', channel: 'WB', impressions: 64200, clicks: 1410, orders: 38, ctr: 2.20, cr: 2.70, spend: 7614, revenue: 19800, roas: 2.60 },
  { id: 'p13', name: 'Тренажёр TRX подвесной', barcode: '4607012345690', channel: 'WB', impressions: 52800, clicks: 820, orders: 24, ctr: 1.55, cr: 2.93, spend: 2788, revenue: 18600, roas: 6.67 },
  { id: 'p14', name: 'Протеин сывороточный 1 кг', barcode: '4607012345691', channel: 'OZON', impressions: 48400, clicks: 980, orders: 18, ctr: 2.02, cr: 1.84, spend: 12348, revenue: 22400, roas: 1.81 },
  { id: 'p15', name: 'Лампа настольная LED', barcode: '4607012345692', channel: 'WB', impressions: 42100, clicks: 1140, orders: 36, ctr: 2.71, cr: 3.16, spend: 6156, revenue: 18400, roas: 2.99 },
  { id: 'p16', name: 'Наушники беспроводные TWS', barcode: '4607012345693', channel: 'OZON', impressions: 38400, clicks: 820, orders: 12, ctr: 2.14, cr: 1.46, spend: 12136, revenue: 18000, roas: 1.48 },
  { id: 'p17', name: 'Йога-коврик премиум', barcode: '4607012345694', channel: 'WB', impressions: 32100, clicks: 680, orders: 24, ctr: 2.12, cr: 3.53, spend: 4080, revenue: 14400, roas: 3.53 },
  { id: 'p18', name: 'Гель для душа мужской', barcode: '4607012345695', channel: 'OZON', impressions: 28400, clicks: 510, orders: 14, ctr: 1.80, cr: 2.75, spend: 4080, revenue: 7000, roas: 1.72 },
  { id: 'p19', name: 'Полотенце махровое набор', barcode: '4607012345696', channel: 'WB', impressions: 22100, clicks: 420, orders: 18, ctr: 1.90, cr: 4.29, spend: 2520, revenue: 10800, roas: 4.29 },
  { id: 'p20', name: 'Кружка термо 450 мл', barcode: '4607012345697', channel: 'OZON', impressions: 18400, clicks: 320, orders: 8, ctr: 1.74, cr: 2.50, spend: 2240, revenue: 4800, roas: 2.14 },
];

export const mockAdsKpis: AdsKpis = {
  budget: 487327,
  budgetDelta: 12,
  cpc: 9.8,
  cpcDelta: -4,
  conversionRate: 2.74,
  conversionRateDelta: 8,
  roas: 4.12,
  roasDelta: 18,
  spendSeries: sparkline(34000, 4000),
  cpcSeries: sparkline(10, 1),
  crSeries: sparkline(3, 1),
  roasSeries: sparkline(4, 1),
};
