import { createAdminClient } from '@/shared/lib/supabase/admin';
import { wbPhotoUrl } from '@/shared/lib/wb-photo';

export type MainCulprit =
  | 'commission_up'
  | 'logistics_up'
  | 'storage_up'
  | 'returns_up'
  | 'cost_up'
  | 'revenue_down'
  | 'price_down'
  | 'none';

export type MarginAnalysisRow = {
  skuId: number;
  title: string;
  myArticle: string | null;
  wbArticle: number | null;
  barcode: string | null;
  photoUrl: string | null;
  marginNowPct: number;
  marginPrevPct: number;
  marginDeltaPp: number;
  revenueNow: number;
  revenuePrev: number;
  revenueDeltaPct: number;
  mainCulprit: MainCulprit;
  recommendation: string;
  unitsNow: number;
  unitsPrev: number;
};

const RECOMMENDATIONS: Record<MainCulprit, string> = {
  commission_up: 'Проверить категорию в WB-кабинете, возможно изменился тариф',
  logistics_up: 'Перейти на FBS или укрупнить упаковку',
  storage_up: 'Сократить остаток на складе',
  returns_up: 'Проверить качество карточки и реальные характеристики',
  cost_up: 'Пересмотреть закупку у поставщика',
  revenue_down: 'Запустить промо / проверить позицию в выдаче',
  price_down: 'Проверить, не понизили ли цену в кабинете',
  none: 'Без значимых изменений',
};

function toNumber(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

type CatalogDb = {
  id: number;
  my_article: string | null;
  wb_article: number | null;
  barcode: string | null;
  title: string | null;
  photo_url: string | null;
  cost_price_rub: number | null;
};

type FactRow = {
  nm_id: number | null;
  rr_dt: string;
  doc_type_name: string | null;
  quantity: number | null;
  retail_price: number | null;
  retail_amount: number | null;
  commission_rub: number | null;
  delivery_rub: number | null;
  storage_fee: number | null;
  rebill_logistic_cost: number | null;
};

type Aggregate = {
  revenue: number;
  commission: number;
  logistics: number;
  storage: number;
  returns: number;
  units: number;
  avgPrice: number;
  priceSum: number;
  priceCount: number;
};

function emptyAggregate(): Aggregate {
  return { revenue: 0, commission: 0, logistics: 0, storage: 0, returns: 0, units: 0, avgPrice: 0, priceSum: 0, priceCount: 0 };
}

function accumulate(agg: Aggregate, f: FactRow): void {
  const qty = toNumber(f.quantity);
  const amount = toNumber(f.retail_amount);
  agg.commission += toNumber(f.commission_rub);
  agg.logistics += toNumber(f.delivery_rub) + toNumber(f.rebill_logistic_cost);
  agg.storage += toNumber(f.storage_fee);

  if (f.doc_type_name === 'Возврат') {
    agg.returns += amount;
    agg.revenue -= amount;
    agg.units -= qty;
  } else {
    agg.revenue += amount;
    agg.units += qty;
    if (f.retail_price != null) {
      agg.priceSum += toNumber(f.retail_price);
      agg.priceCount += 1;
    }
  }
}

function finalizeAvgPrice(agg: Aggregate): void {
  agg.avgPrice = agg.priceCount > 0 ? agg.priceSum / agg.priceCount : 0;
}

export async function fetchMarginAnalysis(): Promise<MarginAnalysisRow[]> {
  const supabase = createAdminClient();

  const now = new Date();
  const nowFrom = iso(new Date(now.getTime() - 30 * 86_400_000));
  const nowTo = iso(now);
  const prevFrom = iso(new Date(now.getTime() - 60 * 86_400_000));
  const prevTo = nowFrom;

  const { data: catalogData, error: catalogError } = await supabase
    .from('sku_catalog')
    .select('id, my_article, wb_article, barcode, title, photo_url, cost_price_rub')
    .eq('is_active', true)
    .order('id', { ascending: true })
    .range(0, 5000);

  if (catalogError || !catalogData) {
    console.error('[fetchMarginAnalysis] sku_catalog', catalogError);
    return [];
  }

  const catalog = catalogData as CatalogDb[];
  const nmIds = [...new Set(catalog.map((c) => c.wb_article).filter((v): v is number => v != null))];
  if (nmIds.length === 0) return [];

  const { data: factData, error: factError } = await supabase
    .from('wb_reports_fact')
    .select(
      'nm_id, rr_dt, doc_type_name, quantity, retail_price, retail_amount, commission_rub, delivery_rub, storage_fee, rebill_logistic_cost',
    )
    .in('nm_id', nmIds)
    .gte('rr_dt', prevFrom)
    .lte('rr_dt', nowTo)
    .range(0, 200_000);

  if (factError || !factData) {
    console.error('[fetchMarginAnalysis] wb_reports_fact', factError);
    return [];
  }

  const nowAgg = new Map<number, Aggregate>();
  const prevAgg = new Map<number, Aggregate>();

  for (const f of factData as FactRow[]) {
    if (f.nm_id == null || !f.rr_dt) continue;
    const bucket = f.rr_dt >= nowFrom && f.rr_dt <= nowTo ? nowAgg : f.rr_dt >= prevFrom && f.rr_dt < prevTo ? prevAgg : null;
    if (!bucket) continue;
    const agg = bucket.get(f.nm_id) ?? emptyAggregate();
    accumulate(agg, f);
    bucket.set(f.nm_id, agg);
  }

  for (const agg of nowAgg.values()) finalizeAvgPrice(agg);
  for (const agg of prevAgg.values()) finalizeAvgPrice(agg);

  const rows: MarginAnalysisRow[] = [];

  for (const cat of catalog) {
    if (cat.wb_article == null) continue;
    const now30 = nowAgg.get(cat.wb_article);
    const prev30 = prevAgg.get(cat.wb_article);
    if (!now30 && !prev30) continue;

    const costPrice = toNumber(cat.cost_price_rub);

    const now30Final = now30 ?? emptyAggregate();
    const prev30Final = prev30 ?? emptyAggregate();

    const cogsNow = costPrice * Math.max(now30Final.units, 0);
    const cogsPrev = costPrice * Math.max(prev30Final.units, 0);

    const profitNow =
      now30Final.revenue - now30Final.commission - now30Final.logistics - now30Final.storage - cogsNow - now30Final.returns;
    const profitPrev =
      prev30Final.revenue - prev30Final.commission - prev30Final.logistics - prev30Final.storage - cogsPrev - prev30Final.returns;

    const marginNowPct = now30Final.revenue > 0 ? (profitNow / now30Final.revenue) * 100 : 0;
    const marginPrevPct = prev30Final.revenue > 0 ? (profitPrev / prev30Final.revenue) * 100 : 0;
    const marginDeltaPp = marginNowPct - marginPrevPct;

    const revenueDeltaPct =
      prev30Final.revenue > 0 ? ((now30Final.revenue - prev30Final.revenue) / prev30Final.revenue) * 100 : 0;

    // Δ доли от выручки каждой статьи — положительная дельта = статья съела больше маржи
    const pctOfRevenue = (value: number, agg: Aggregate) => (agg.revenue > 0 ? (value / agg.revenue) * 100 : 0);

    const commissionDeltaPp = pctOfRevenue(now30Final.commission, now30Final) - pctOfRevenue(prev30Final.commission, prev30Final);
    const logisticsDeltaPp = pctOfRevenue(now30Final.logistics, now30Final) - pctOfRevenue(prev30Final.logistics, prev30Final);
    const storageDeltaPp = pctOfRevenue(now30Final.storage, now30Final) - pctOfRevenue(prev30Final.storage, prev30Final);
    const returnsDeltaPp = pctOfRevenue(now30Final.returns, now30Final) - pctOfRevenue(prev30Final.returns, prev30Final);
    const cogsDeltaPp = pctOfRevenue(cogsNow, now30Final) - pctOfRevenue(cogsPrev, prev30Final);
    const priceDeltaPct =
      prev30Final.avgPrice > 0 ? ((now30Final.avgPrice - prev30Final.avgPrice) / prev30Final.avgPrice) * 100 : 0;
    const revenueDropDeltaPp = revenueDeltaPct < -5 ? -revenueDeltaPct * 0.1 : 0; // вспомогательный «вес» для сравнения

    const candidates: { key: MainCulprit; impact: number }[] = [
      { key: 'commission_up', impact: commissionDeltaPp },
      { key: 'logistics_up', impact: logisticsDeltaPp },
      { key: 'storage_up', impact: storageDeltaPp },
      { key: 'returns_up', impact: returnsDeltaPp },
      { key: 'cost_up', impact: cogsDeltaPp },
      { key: 'price_down', impact: priceDeltaPct < -2 ? -priceDeltaPct : 0 },
      { key: 'revenue_down', impact: revenueDropDeltaPp },
    ];

    let mainCulprit: MainCulprit = 'none';
    let bestImpact = 0.5; // порог значимости, pp
    for (const c of candidates) {
      if (c.impact > bestImpact) {
        bestImpact = c.impact;
        mainCulprit = c.key;
      }
    }

    if (mainCulprit === 'none' && marginDeltaPp < -0.5 && now30Final.revenue <= 0 && prev30Final.revenue > 0) {
      mainCulprit = 'revenue_down';
    }

    rows.push({
      skuId: cat.id,
      title: cat.title ?? cat.my_article ?? `nm ${cat.wb_article}`,
      myArticle: cat.my_article,
      wbArticle: cat.wb_article,
      barcode: cat.barcode,
      photoUrl: cat.photo_url ?? wbPhotoUrl(cat.wb_article),
      marginNowPct: Math.round(marginNowPct * 100) / 100,
      marginPrevPct: Math.round(marginPrevPct * 100) / 100,
      marginDeltaPp: Math.round(marginDeltaPp * 100) / 100,
      revenueNow: Math.round(now30Final.revenue * 100) / 100,
      revenuePrev: Math.round(prev30Final.revenue * 100) / 100,
      revenueDeltaPct: Math.round(revenueDeltaPct * 100) / 100,
      mainCulprit,
      recommendation: RECOMMENDATIONS[mainCulprit],
      unitsNow: Math.max(now30Final.units, 0),
      unitsPrev: Math.max(prev30Final.units, 0),
    });
  }

  return rows.sort((a, b) => a.marginDeltaPp - b.marginDeltaPp);
}
