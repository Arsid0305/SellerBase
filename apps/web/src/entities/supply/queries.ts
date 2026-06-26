import { createAdminClient } from '@/shared/lib/supabase/admin';
import { wbPhotoUrl } from '@/shared/lib/wb-photo';
import type { DeficitRow, DeficitSummary } from '@/features/deficit/types';
import type { SupplyRecommendationRowDb, SkuCatalogRowDb } from './types';

function toNumber(v: unknown): number {
  if (v == null) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Читает v_supply_recommendation + джоинит sku_catalog для названий и цены.
 * Дополнительно подтягивает среднюю цену реализации из wb_reports_fact для расчёта упущенной выручки.
 */
export async function fetchSupplyRecommendation(): Promise<DeficitRow[]> {
  const supabase = createAdminClient();

  const { data: supply, error: e1 } = await supabase
    .from('v_supply_recommendation')
    .select('sku_id, my_article, wb_article, barcode, units_per_day, total_stock, lead_time_days, safety_stock_days, units_to_order')
    .range(0, 5000);

  if (e1) {
    console.error('[fetchSupplyRecommendation] supply error', e1);
    return [];
  }
  const rows = (supply ?? []) as SupplyRecommendationRowDb[];
  if (rows.length === 0) return [];

  const skuIds = [...new Set(rows.map((r) => r.sku_id).filter((id): id is number => id != null))];
  const wbArticles = [...new Set(rows.map((r) => r.wb_article).filter((v): v is number => v != null))];

  const [catalogResult, pricesResult] = await Promise.all([
    supabase
      .from('sku_catalog')
      .select('id, title, category, brand, cost_price_rub')
      .in('id', skuIds),
    wbArticles.length > 0
      ? supabase
          .from('wb_reports_fact')
          .select('nm_id, retail_amount, quantity')
          .in('nm_id', wbArticles)
          .gte('rr_dt', new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10))
          .range(0, 100_000)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const catalogMap = new Map<number, SkuCatalogRowDb>();
  for (const row of (catalogResult.data ?? []) as SkuCatalogRowDb[]) {
    if (row.id != null) catalogMap.set(row.id, row);
  }

  type PriceRow = { nm_id: number; retail_amount: number | null; quantity: number | null };
  const priceAgg = new Map<number, { amount: number; qty: number }>();
  for (const row of (pricesResult.data ?? []) as PriceRow[]) {
    if (row.nm_id == null) continue;
    const cur = priceAgg.get(row.nm_id) ?? { amount: 0, qty: 0 };
    cur.amount += toNumber(row.retail_amount);
    cur.qty += toNumber(row.quantity);
    priceAgg.set(row.nm_id, cur);
  }

  return rows.map<DeficitRow>((row) => {
    const cat = catalogMap.get(row.sku_id);
    const priceData = row.wb_article != null ? priceAgg.get(row.wb_article) : undefined;
    const avgPrice = priceData && priceData.qty > 0 ? priceData.amount / priceData.qty : 0;

    const unitsPerDay = toNumber(row.units_per_day);
    const totalStock = toNumber(row.total_stock);
    // Если нет ни продаж, ни остатка — SKU фактически outOfStock, daysLeft = 0 (не 999, чтобы не ломать классификацию дефицита).
    // 999 оставляем только когда нет продаж, но остаток есть (товар «лежит» — не критично).
    const daysLeft =
      unitsPerDay > 0
        ? Math.floor(totalStock / unitsPerDay)
        : totalStock > 0
          ? 999
          : 0;
    const forecastDemand = unitsPerDay * 30 * avgPrice;
    // Упущенная выручка: сколько мы потеряли за срок восполнения (lead_time + safety) при нулевом остатке
    const recoveryDays = toNumber(row.lead_time_days) + toNumber(row.safety_stock_days);
    const lostRevenue =
      totalStock <= 0 ? unitsPerDay * recoveryDays * avgPrice : 0;

    return {
      id: String(row.sku_id),
      name: cat?.title ?? row.my_article ?? 'Без названия',
      barcode: row.barcode ?? '',
      myArticle: row.my_article ?? null,
      wbArticle: row.wb_article ?? null,
      photoUrl: wbPhotoUrl(row.wb_article),
      channel: 'WB',
      warehouse: '',
      tags: [],
      lostRevenue: Math.round(lostRevenue),
      forecastDemand: Math.round(forecastDemand),
      daysLeft,
      toSupply: row.units_to_order ?? 0,
      dailySales: Math.round(unitsPerDay * 100) / 100,
      stock: totalStock,
    };
  });
}

/** Порог "реального дефицита" в днях — товары с daysLeft <= этого попадают в раздел. */
export const DEFICIT_DAYS_THRESHOLD = 14;

export function buildDeficitSummary(rows: DeficitRow[]): DeficitSummary {
  const outOfStock = rows.filter((r) => r.stock <= 0).length;
  const critical = rows.filter((r) => r.daysLeft < 3 && r.stock > 0).length;
  const warning = rows.filter((r) => r.daysLeft >= 3 && r.daysLeft <= 7).length;
  return {
    totalLostRevenue: rows.reduce((acc, r) => acc + r.lostRevenue, 0),
    outOfStockCount: outOfStock,
    criticalCount: critical,
    warningCount: warning,
    totalRows: outOfStock + critical + warning,
  };
}

/** Только товары, реально требующие поставки (≤14 дней запаса или закончились). */
export function filterRealDeficit(rows: DeficitRow[]): DeficitRow[] {
  return rows.filter((r) => r.stock <= 0 || r.daysLeft <= DEFICIT_DAYS_THRESHOLD);
}
