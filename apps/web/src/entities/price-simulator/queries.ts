import { createAdminClient } from '@/shared/lib/supabase/admin';
import { wbPhotoUrl } from '@/shared/lib/wb-photo';
import { ACQUIRING_PCT, TAX_PCT } from '@/shared/lib/business-rules';
import { computeBreakEven } from '@/shared/lib/break-even';

export type PriceSimulatorRow = {
  skuId: number;
  title: string;
  myArticle: string | null;
  wbArticle: number | null;
  barcode: string | null;
  photoUrl: string | null;
  currentPrice: number;
  totalCostPerUnit: number;
  unitsSold30d: number;
  breakEven: number;
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

type CatalogRow = {
  id: number;
  my_article: string | null;
  wb_article: number | null;
  barcode: string | null;
  title: string | null;
  photo_url: string | null;
  cost_price_rub: number | null;
};

type Agg = {
  priceSum: number;
  priceCount: number;
  commissionRub: number;
  deliveryRub: number;
  storageRub: number;
  acquiringRub: number;
  unitsSold: number;
  ordersCount: number;
  returnsCount: number;
};

export async function fetchPriceSimulatorRows(): Promise<PriceSimulatorRow[]> {
  const supabase = createAdminClient();
  const since30 = iso(new Date(Date.now() - 30 * 86_400_000));

  const [catalogRes, aggRes] = await Promise.all([
    supabase
      .from('sku_catalog')
      .select('id, my_article, wb_article, barcode, title, photo_url, cost_price_rub')
      .range(0, 10_000),
    // Заменено: .range(0, 200_000) на wb_reports_fact — теперь агрегат в БД через RPC.
    supabase.rpc('get_price_simulator_agg', { p_since: since30 }),
  ]);

  if (catalogRes.error) console.error('[fetchPriceSimulatorRows] sku_catalog', catalogRes.error);
  if (aggRes.error) console.error('[fetchPriceSimulatorRows] price_simulator_agg', aggRes.error);

  const catalog = (catalogRes.data ?? []) as CatalogRow[];
  type AggRow = {
    nm_id: number;
    price_sum: number | string | null;
    price_count: number | null;
    commission_rub: number | string | null;
    delivery_rub: number | string | null;
    storage_rub: number | string | null;
    acquiring_rub: number | string | null;
    units_sold: number | string | null;
    returns_count: number | string | null;
  };
  const aggRows = (aggRes.data ?? []) as AggRow[];

  const aggByNm = new Map<number, Agg>();
  for (const a of aggRows) {
    if (a.nm_id == null) continue;
    const unitsSold = toNumber(a.units_sold);
    aggByNm.set(a.nm_id, {
      priceSum: toNumber(a.price_sum),
      priceCount: toNumber(a.price_count),
      commissionRub: toNumber(a.commission_rub),
      deliveryRub: toNumber(a.delivery_rub),
      storageRub: toNumber(a.storage_rub),
      acquiringRub: toNumber(a.acquiring_rub),
      unitsSold,
      ordersCount: unitsSold,
      returnsCount: toNumber(a.returns_count),
    });
  }

  const rows: PriceSimulatorRow[] = [];

  for (const c of catalog) {
    const costPriceRub = toNumber(c.cost_price_rub);
    if (!costPriceRub) continue;
    if (c.wb_article == null) continue;

    const agg = aggByNm.get(c.wb_article);
    if (!agg || agg.unitsSold <= 0) continue;

    const units = agg.unitsSold;
    const currentPrice = agg.priceCount > 0 ? agg.priceSum / agg.priceCount : 0;
    if (currentPrice <= 0) continue;

    const revenue = currentPrice * units;
    const costPerUnit = costPriceRub;
    const logisticsPerUnit = agg.deliveryRub / units;
    const storagePerUnit = agg.storageRub / units;
    const commissionPct = revenue > 0 ? agg.commissionRub / revenue : 0;
    const ordersAndReturns = agg.ordersCount + agg.returnsCount;
    const returnsPct = ordersAndReturns > 0 ? agg.returnsCount / ordersAndReturns : 0;

    const fixedPerUnit = costPerUnit + logisticsPerUnit + storagePerUnit;
    const variableShare = commissionPct + ACQUIRING_PCT + TAX_PCT + returnsPct;

    // computeBreakEven вернёт POSITIVE_INFINITY если variableShare ≥ 1 —
    // точка недостижима, UI рисует «—».
    const breakEven = computeBreakEven({
      costPerUnit,
      logisticsPerUnit,
      storagePerUnit,
      commissionPct,
      returnsPct,
    });
    const totalCostPerUnit = fixedPerUnit + currentPrice * variableShare;

    rows.push({
      skuId: c.id,
      title: c.title ?? '',
      myArticle: c.my_article,
      wbArticle: c.wb_article,
      barcode: c.barcode,
      photoUrl: c.photo_url ?? wbPhotoUrl(c.wb_article),
      currentPrice,
      totalCostPerUnit,
      unitsSold30d: units,
      breakEven,
    });
  }

  return rows.sort((a, b) => b.unitsSold30d - a.unitsSold30d);
}
