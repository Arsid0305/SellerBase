import { createAdminClient } from '@/shared/lib/supabase/admin';
import type {
  WbTariffsBox,
  WbTariffsReturn,
  WbTariffsBoxDynamicsPoint,
  WbAverageWarehouseCoef,
} from './types';

const TABLE_MISSING = '42P01';

type BoxDb = {
  id: number;
  effective_date: string;
  warehouse_name: string;
  geo_name: string;
  box_delivery_base: number | null;
  box_delivery_liter: number | null;
  box_delivery_marketplace_base: number | null;
  box_delivery_marketplace_liter: number | null;
  box_storage_base: number | null;
  box_storage_liter: number | null;
  warehouse_coef: number | null;
};

type ReturnDb = {
  id: number;
  effective_date: string;
  warehouse_name: string;
  geo_name: string;
  return_base: number | null;
  return_liter: number | null;
};

const BOX_COLS =
  'id, effective_date, warehouse_name, geo_name, box_delivery_base, box_delivery_liter, box_delivery_marketplace_base, box_delivery_marketplace_liter, box_storage_base, box_storage_liter, warehouse_coef';

const RETURN_COLS =
  'id, effective_date, warehouse_name, geo_name, return_base, return_liter';

function mapBox(r: BoxDb): WbTariffsBox {
  return {
    id: r.id,
    effectiveDate: r.effective_date,
    warehouseName: r.warehouse_name,
    geoName: r.geo_name,
    boxDeliveryBase: r.box_delivery_base ?? 0,
    boxDeliveryLiter: r.box_delivery_liter ?? 0,
    boxDeliveryMarketplaceBase: r.box_delivery_marketplace_base ?? 0,
    boxDeliveryMarketplaceLiter: r.box_delivery_marketplace_liter ?? 0,
    boxStorageBase: r.box_storage_base ?? 0,
    boxStorageLiter: r.box_storage_liter ?? 0,
    warehouseCoef: r.warehouse_coef ?? 1,
  };
}

function mapReturn(r: ReturnDb): WbTariffsReturn {
  return {
    id: r.id,
    effectiveDate: r.effective_date,
    warehouseName: r.warehouse_name,
    geoName: r.geo_name,
    returnBase: r.return_base ?? 0,
    returnLiter: r.return_liter ?? 0,
  };
}

async function getLatestBoxDate(): Promise<string | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('wb_tariffs_box')
    .select('effective_date')
    .order('effective_date', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return (data as { effective_date: string }).effective_date;
}

async function getLatestReturnDate(): Promise<string | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('wb_tariffs_return')
    .select('effective_date')
    .order('effective_date', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return (data as { effective_date: string }).effective_date;
}

export async function fetchLatestBoxTariffs(): Promise<WbTariffsBox[]> {
  const supabase = createAdminClient();
  const date = await getLatestBoxDate();
  if (!date) return [];
  const { data, error } = await supabase
    .from('wb_tariffs_box')
    .select(BOX_COLS)
    .eq('effective_date', date)
    .order('warehouse_name', { ascending: true });
  if (error) {
    if (error.code === TABLE_MISSING) return [];
    console.error('[fetchLatestBoxTariffs]', error);
    return [];
  }
  return ((data ?? []) as BoxDb[]).map(mapBox);
}

export async function fetchLatestReturnTariffs(): Promise<WbTariffsReturn[]> {
  const supabase = createAdminClient();
  const date = await getLatestReturnDate();
  if (!date) return [];
  const { data, error } = await supabase
    .from('wb_tariffs_return')
    .select(RETURN_COLS)
    .eq('effective_date', date)
    .order('warehouse_name', { ascending: true });
  if (error) {
    if (error.code === TABLE_MISSING) return [];
    console.error('[fetchLatestReturnTariffs]', error);
    return [];
  }
  return ((data ?? []) as ReturnDb[]).map(mapReturn);
}

export async function fetchBoxTariffsDynamics(
  warehouseName: string,
  days = 90,
): Promise<WbTariffsBoxDynamicsPoint[]> {
  const supabase = createAdminClient();
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);
  const sinceIso = since.toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('wb_tariffs_box')
    .select('effective_date, warehouse_coef')
    .eq('warehouse_name', warehouseName)
    .gte('effective_date', sinceIso)
    .order('effective_date', { ascending: true });
  if (error) {
    if (error.code === TABLE_MISSING) return [];
    console.error('[fetchBoxTariffsDynamics]', error);
    return [];
  }
  return ((data ?? []) as { effective_date: string; warehouse_coef: number | null }[]).map((r) => ({
    effectiveDate: r.effective_date,
    warehouseCoef: r.warehouse_coef ?? 1,
  }));
}

/**
 * Возвращает дату <= refDate, на которую есть тарифы box (или null).
 */
async function getNearestBoxDateAtOrBefore(refDate: string): Promise<string | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('wb_tariffs_box')
    .select('effective_date')
    .lte('effective_date', refDate)
    .order('effective_date', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return (data as { effective_date: string }).effective_date;
}

export async function fetchAverageWarehouseCoefAtOrBefore(
  refDate: string,
): Promise<WbAverageWarehouseCoef | null> {
  const eff = await getNearestBoxDateAtOrBefore(refDate);
  if (!eff) return null;
  return fetchAverageWarehouseCoef(eff);
}

/**
 * Взвешенное среднее коэф склада по фактическим остаткам пользователя (wb_stocks).
 * Если переданная date пуста — берётся последняя из wb_tariffs_box.
 */
export async function fetchAverageWarehouseCoef(
  date?: string,
): Promise<WbAverageWarehouseCoef | null> {
  const supabase = createAdminClient();
  const eff = date ?? (await getLatestBoxDate());
  if (!eff) return null;

  const tariffsRes = await supabase
    .from('wb_tariffs_box')
    .select('warehouse_name, warehouse_coef')
    .eq('effective_date', eff);
  if (tariffsRes.error) {
    if (tariffsRes.error.code === TABLE_MISSING) return null;
    console.error('[fetchAverageWarehouseCoef tariffs]', tariffsRes.error);
    return null;
  }
  const coefByWh = new Map<string, number>();
  for (const r of (tariffsRes.data ?? []) as { warehouse_name: string; warehouse_coef: number | null }[]) {
    coefByWh.set(r.warehouse_name, r.warehouse_coef ?? 1);
  }
  if (coefByWh.size === 0) return null;

  const stocksRes = await supabase
    .from('wb_stocks')
    .select('warehouse_name, quantity')
    .range(0, 50_000);
  if (stocksRes.error) {
    if (stocksRes.error.code === TABLE_MISSING) {
      return { coef: 0, date: eff, warehouseCount: 0 };
    }
    console.error('[fetchAverageWarehouseCoef stocks]', stocksRes.error);
    return null;
  }

  const stocksByWh = new Map<string, number>();
  for (const s of (stocksRes.data ?? []) as { warehouse_name: string; quantity: number | null }[]) {
    if (!s.warehouse_name) continue;
    stocksByWh.set(s.warehouse_name, (stocksByWh.get(s.warehouse_name) ?? 0) + (s.quantity ?? 0));
  }

  let weightedSum = 0;
  let totalQty = 0;
  let matched = 0;
  for (const [wh, qty] of stocksByWh) {
    const coef = coefByWh.get(wh);
    if (coef === undefined || qty <= 0) continue;
    weightedSum += coef * qty;
    totalQty += qty;
    matched += 1;
  }
  if (totalQty === 0) return { coef: 0, date: eff, warehouseCount: 0 };
  return { coef: weightedSum / totalQty, date: eff, warehouseCount: matched };
}
