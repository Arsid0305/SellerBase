import { createAdminClient } from '@/shared/lib/supabase/admin';
import { wbPhotoUrl } from '@/shared/lib/wb-photo';
import type { SkuMarginAnalysis } from './types';
import { rowToWeek, pickWorstComponent, avgWeeks, type BreakdownRow } from './math';

type BreakdownDb = BreakdownRow & {
  nm_id: number;
  sales_qty: number | null;
  returns_qty: number | null;
};

type CatalogDb = {
  wb_article: number | null;
  my_article: string | null;
  title: string | null;
  subject_name: string | null;
  photo_url: string | null;
};

export async function fetchMarginAnalyzerData(): Promise<SkuMarginAnalysis[]> {
  const supabase = createAdminClient();
  const since = new Date(Date.now() - 5 * 7 * 86_400_000).toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from('v_margin_breakdown_weekly')
    .select(
      'nm_id, week_start, sales_qty, by_card_rub, ppvz_for_pay_rub, commission_full_rub, logistics_rub, storage_rub, acquiring_rub, penalty_rub, deduction_rub, rebill_logistic_rub, returns_rub, returns_qty, cogs_rub, net_profit_rub',
    )
    .gte('week_start', since)
    .order('nm_id', { ascending: true })
    .order('week_start', { ascending: true })
    .range(0, 50_000);

  if (error || !data) {
    console.error('[fetchMarginAnalyzerData] v_margin_breakdown_weekly', error);
    return [];
  }

  const byNm = new Map<number, BreakdownDb[]>();
  for (const r of data as BreakdownDb[]) {
    if (r.nm_id == null) continue;
    const bucket = byNm.get(r.nm_id) ?? [];
    bucket.push(r);
    byNm.set(r.nm_id, bucket);
  }

  const nmIds = [...byNm.keys()];
  if (nmIds.length === 0) return [];

  const { data: catalog } = await supabase
    .from('sku_catalog')
    .select('wb_article, my_article, title, subject_name, photo_url')
    .in('wb_article', nmIds);

  const catalogMap = new Map<number, CatalogDb>();
  for (const c of (catalog ?? []) as CatalogDb[]) {
    if (c.wb_article != null) catalogMap.set(c.wb_article, c);
  }

  const result: SkuMarginAnalysis[] = [];
  for (const [nmId, rows] of byNm.entries()) {
    if (rows.length === 0) continue;
    const weeks = rows.map(rowToWeek);
    const current = weeks[weeks.length - 1];
    if (!current) continue;
    const prev = weeks.slice(0, -1);
    const prevAvg = avgWeeks(prev);
    const cat = catalogMap.get(nmId);
    const worst = prevAvg ? pickWorstComponent(current, prevAvg) : null;
    const deltaPct =
      prevAvg?.marginPct != null && current.marginPct != null
        ? current.marginPct - prevAvg.marginPct
        : null;

    result.push({
      nmId,
      myArticle: cat?.my_article ?? null,
      title: cat?.title ?? null,
      subjectName: cat?.subject_name ?? null,
      photoUrl: cat?.photo_url ?? wbPhotoUrl(nmId),
      weeks,
      current,
      prevAvg,
      deltaPct,
      worstComponent: worst,
    });
  }

  return result.sort((a, b) => {
    const ad = a.deltaPct ?? 0;
    const bd = b.deltaPct ?? 0;
    return ad - bd;
  });
}
