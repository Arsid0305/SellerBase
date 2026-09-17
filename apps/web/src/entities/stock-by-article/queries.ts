import { createAdminClient } from '@/shared/lib/supabase/admin';
import type { FbsMismatchRow, StockByArticleRow } from './types';

const num = (v: unknown): number => Number(v ?? 0);
const numOrNull = (v: unknown): number | null => (v == null ? null : Number(v));

/**
 * Остатки по артикулам. Порядок задаём здесь, а не в базе: сначала то, где
 * заперты деньги, потом остальное - так первая строка сразу про проблему.
 */
export async function fetchStockByArticle(): Promise<StockByArticleRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('v_stock_by_article')
    .select(
      'artikul, tovar, vb_fbo, ozon_fbo, fbs, vsego, mertvoe, dney_vb, dney_ozon, dney_vsego, prodazh_vb_28, prodazh_ozon_28, cost_price_rub',
    )
    .range(0, 5000);

  if (error) {
    console.error('[fetchStockByArticle]', error);
    return [];
  }

  const rows = (data ?? []).map((r: Record<string, unknown>) => ({
    article: String(r.artikul ?? ''),
    title: (r.tovar as string | null) ?? null,
    wbFbo: num(r.vb_fbo),
    ozonFbo: num(r.ozon_fbo),
    fbs: num(r.fbs),
    total: num(r.vsego),
    dead: num(r.mertvoe),
    daysWb: numOrNull(r.dney_vb),
    daysOzon: numOrNull(r.dney_ozon),
    daysTotal: numOrNull(r.dney_vsego),
    salesWb28: num(r.prodazh_vb_28),
    salesOzon28: num(r.prodazh_ozon_28),
    costPrice: numOrNull(r.cost_price_rub),
  }));

  return rows.sort((a, b) => b.dead - a.dead || b.total - a.total);
}

/**
 * Расхождение по ФБС. Пустой список - значит площадки согласны, и тогда
 * страница про это молчит: предупреждение без повода перестают замечать.
 */
export async function fetchFbsMismatch(): Promise<FbsMismatchRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('v_fbs_stock_match')
    .select('artikul, tovar, zayavleno_vb, zayavleno_ozon, raznica, sostoyanie')
    .neq('raznica', 0)
    .range(0, 5000);

  if (error) {
    console.error('[fetchFbsMismatch]', error);
    return [];
  }

  return (data ?? []).map((r: Record<string, unknown>) => ({
    article: String(r.artikul ?? ''),
    title: (r.tovar as string | null) ?? null,
    declaredWb: num(r.zayavleno_vb),
    declaredOzon: num(r.zayavleno_ozon),
    diff: num(r.raznica),
    state: String(r.sostoyanie ?? ''),
  }));
}
