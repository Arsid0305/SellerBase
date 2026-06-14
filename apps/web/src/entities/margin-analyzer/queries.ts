import { createAdminClient } from '@/shared/lib/supabase/admin';
import { wbPhotoUrl } from '@/shared/lib/wb-photo';
import type { ComponentKey, SkuMarginAnalysis, WeekBreakdown } from './types';

function toNumber(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

type BreakdownDb = {
  nm_id: number;
  week_start: string;
  sales_qty: number | null;
  by_card_rub: number | null;
  ppvz_for_pay_rub: number | null;
  commission_full_rub: number | null;
  logistics_rub: number | null;
  storage_rub: number | null;
  acquiring_rub: number | null;
  penalty_rub: number | null;
  deduction_rub: number | null;
  rebill_logistic_rub: number | null;
  returns_rub: number | null;
  returns_qty: number | null;
  cogs_rub: number | null;
  net_profit_rub: number | null;
};

type CatalogDb = {
  wb_article: number | null;
  my_article: string | null;
  title: string | null;
  subject_name: string | null;
  photo_url: string | null;
};

function rowToWeek(row: BreakdownDb): WeekBreakdown {
  const byCard = toNumber(row.by_card_rub);
  const net = toNumber(row.net_profit_rub);
  const taxRate = 0.07;
  const components: Record<ComponentKey, number> = {
    commission: toNumber(row.commission_full_rub),
    logistics: toNumber(row.logistics_rub),
    storage: toNumber(row.storage_rub),
    acquiring: toNumber(row.acquiring_rub),
    penalty: toNumber(row.penalty_rub),
    deduction: toNumber(row.deduction_rub),
    rebillLogistic: toNumber(row.rebill_logistic_rub),
    cogs: toNumber(row.cogs_rub),
    tax: byCard * taxRate,
    returns: toNumber(row.returns_rub),
  };
  return {
    weekStart: row.week_start,
    byCardRub: byCard,
    ppvzForPayRub: toNumber(row.ppvz_for_pay_rub),
    netProfitRub: net,
    marginPct: byCard > 0 ? net / byCard : null,
    components,
  };
}

function pickWorstComponent(
  current: WeekBreakdown,
  prevAvg: WeekBreakdown,
): { key: ComponentKey; deltaPctOfRevenue: number } | null {
  if (current.byCardRub <= 0 || prevAvg.byCardRub <= 0) return null;
  let worst: { key: ComponentKey; deltaPctOfRevenue: number } | null = null;
  (Object.keys(current.components) as ComponentKey[]).forEach((key) => {
    const curPct = current.components[key] / current.byCardRub;
    const prevPct = prevAvg.components[key] / prevAvg.byCardRub;
    const delta = curPct - prevPct;
    if (delta > 0 && (!worst || delta > worst.deltaPctOfRevenue)) {
      worst = { key, deltaPctOfRevenue: delta };
    }
  });
  return worst;
}

function avgWeeks(weeks: WeekBreakdown[]): WeekBreakdown | null {
  if (weeks.length === 0) return null;
  const n = weeks.length;
  const summed: WeekBreakdown = {
    weekStart: '__avg__',
    byCardRub: 0,
    ppvzForPayRub: 0,
    netProfitRub: 0,
    marginPct: null,
    components: {
      commission: 0, logistics: 0, storage: 0, acquiring: 0, penalty: 0,
      deduction: 0, rebillLogistic: 0, cogs: 0, tax: 0, returns: 0,
    },
  };
  for (const w of weeks) {
    summed.byCardRub += w.byCardRub;
    summed.ppvzForPayRub += w.ppvzForPayRub;
    summed.netProfitRub += w.netProfitRub;
    (Object.keys(summed.components) as ComponentKey[]).forEach((k) => {
      summed.components[k] += w.components[k];
    });
  }
  const avg: WeekBreakdown = {
    ...summed,
    byCardRub: summed.byCardRub / n,
    ppvzForPayRub: summed.ppvzForPayRub / n,
    netProfitRub: summed.netProfitRub / n,
    components: { ...summed.components },
  };
  (Object.keys(avg.components) as ComponentKey[]).forEach((k) => {
    avg.components[k] = summed.components[k] / n;
  });
  avg.marginPct = avg.byCardRub > 0 ? avg.netProfitRub / avg.byCardRub : null;
  return avg;
}

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
