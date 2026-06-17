import { createAdminClient } from '@/shared/lib/supabase/admin';
import { wbPhotoUrl } from '@/shared/lib/wb-photo';

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

const ACQUIRING_PCT = 0.015;
const TAX_PCT = 0.06;

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

type ReportRow = {
  nm_id: number | null;
  retail_price: number | null;
  commission_rub: number | null;
  delivery_rub: number | null;
  storage_fee: number | null;
  acquiring_fee: number | null;
  quantity: number | null;
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

function emptyAgg(): Agg {
  return {
    priceSum: 0,
    priceCount: 0,
    commissionRub: 0,
    deliveryRub: 0,
    storageRub: 0,
    acquiringRub: 0,
    unitsSold: 0,
    ordersCount: 0,
    returnsCount: 0,
  };
}

export async function fetchPriceSimulatorRows(): Promise<PriceSimulatorRow[]> {
  const supabase = createAdminClient();
  const since30 = iso(new Date(Date.now() - 30 * 86_400_000));

  const [catalogRes, reportsRes] = await Promise.all([
    supabase
      .from('sku_catalog')
      .select('id, my_article, wb_article, barcode, title, photo_url, cost_price_rub')
      .range(0, 10_000),
    supabase
      .from('wb_reports_fact')
      .select('nm_id, retail_price, commission_rub, delivery_rub, storage_fee, acquiring_fee, quantity')
      .gte('rr_dt', since30)
      .range(0, 200_000),
  ]);

  if (catalogRes.error) console.error('[fetchPriceSimulatorRows] sku_catalog', catalogRes.error);
  if (reportsRes.error) console.error('[fetchPriceSimulatorRows] wb_reports_fact', reportsRes.error);

  const catalog = (catalogRes.data ?? []) as CatalogRow[];
  const reports = (reportsRes.data ?? []) as ReportRow[];

  const aggByNm = new Map<number, Agg>();
  for (const r of reports) {
    if (r.nm_id == null) continue;
    const agg = aggByNm.get(r.nm_id) ?? emptyAgg();
    const qty = toNumber(r.quantity);

    if (qty > 0) {
      agg.unitsSold += qty;
      agg.ordersCount += qty;
      if (r.retail_price != null) {
        agg.priceSum += toNumber(r.retail_price);
        agg.priceCount += 1;
      }
    } else if (qty < 0) {
      agg.returnsCount += Math.abs(qty);
    }

    agg.commissionRub += toNumber(r.commission_rub);
    agg.deliveryRub += toNumber(r.delivery_rub);
    agg.storageRub += toNumber(r.storage_fee);
    agg.acquiringRub += toNumber(r.acquiring_fee);

    aggByNm.set(r.nm_id, agg);
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
    const denom = 1 - variableShare;

    const breakEven = denom > 0 ? fixedPerUnit / denom : fixedPerUnit;
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
