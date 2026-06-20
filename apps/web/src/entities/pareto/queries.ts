import { createAdminClient } from '@/shared/lib/supabase/admin';
import type { PnlSkuRow, PeriodRange } from '@/entities/pnl/types';
import { wbPhotoUrl } from '@/shared/lib/wb-photo';
import { ABC_THRESHOLDS } from '@/shared/lib/business-rules';

export type ParetoZone = 'A' | 'B' | 'C';

export type ParetoItem = {
  rank: number;
  skuId: number;
  name: string;
  barcode: string;
  photoUrl: string | null;
  revenue: number;
  sharePct: number;
  cumPct: number;
  zone: ParetoZone;
};

export type ParetoSummary = {
  totalRevenue: number;
  topPctOfSkus: number;
  topSkusContributePct: number;
  zoneACount: number;
  zoneAAvgRevenue: number;
};

export type ParetoData = {
  items: ParetoItem[];
  summary: ParetoSummary;
};

function toNumber(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

type CatalogLite = {
  id: number;
  barcode: string | null;
  title: string | null;
  my_article: string | null;
  wb_article: number | null;
  photo_url: string | null;
};

export async function fetchParetoData(period: PeriodRange): Promise<ParetoData> {
  const supabase = createAdminClient();

  const { data: rpcData, error } = await supabase.rpc('get_full_pnl_by_period', {
    p_from: period.from,
    p_to: period.to,
  });
  if (error) {
    console.error('[fetchParetoData] RPC error', error);
    return emptyData();
  }

  const rows = (rpcData ?? []) as PnlSkuRow[];
  const withRevenue = rows
    .map((r) => ({ skuId: r.sku_id, revenue: toNumber(r.revenue_rub), barcodeRpc: r.barcode ?? '' }))
    .filter((r) => r.revenue > 0)
    .sort((a, b) => b.revenue - a.revenue);

  if (withRevenue.length === 0) return emptyData();

  const skuIds = withRevenue.map((r) => r.skuId);
  const catalogMap = new Map<number, CatalogLite>();
  const CHUNK = 500;
  const chunks: number[][] = [];
  for (let i = 0; i < skuIds.length; i += CHUNK) chunks.push(skuIds.slice(i, i + CHUNK));
  const results = await Promise.all(
    chunks.map((slice) =>
      supabase
        .from('sku_catalog')
        .select('id, barcode, title, my_article, wb_article, photo_url')
        .in('id', slice)
    )
  );
  for (const { data: cat, error: catErr } of results) {
    if (catErr) {
      console.error('[fetchParetoData] sku_catalog error', catErr);
      continue;
    }
    for (const c of (cat ?? []) as CatalogLite[]) catalogMap.set(c.id, c);
  }

  const totalRevenue = withRevenue.reduce((acc, r) => acc + r.revenue, 0);

  let cum = 0;
  const items: ParetoItem[] = withRevenue.map((r, idx) => {
    cum += r.revenue;
    const cumPct = totalRevenue > 0 ? (cum / totalRevenue) * 100 : 0;
    const sharePct = totalRevenue > 0 ? (r.revenue / totalRevenue) * 100 : 0;
    const zone: ParetoZone =
      cumPct <= ABC_THRESHOLDS.a * 100 ? 'A' : cumPct <= ABC_THRESHOLDS.b * 100 ? 'B' : 'C';
    const cat = catalogMap.get(r.skuId);
    const barcode = cat?.barcode ?? r.barcodeRpc ?? '';
    const name = cat?.title ?? cat?.my_article ?? 'Без названия';
    const photoUrl = cat?.photo_url ?? wbPhotoUrl(cat?.wb_article ?? null);
    return {
      rank: idx + 1,
      skuId: r.skuId,
      name,
      barcode,
      photoUrl,
      revenue: Math.round(r.revenue),
      sharePct: Math.round(sharePct * 10) / 10,
      cumPct: Math.round(cumPct * 10) / 10,
      zone,
    };
  });

  const zoneA = items.filter((i) => i.zone === 'A');
  const zoneACount = zoneA.length;
  const zoneARevenue = zoneA.reduce((acc, i) => acc + i.revenue, 0);
  const topPctOfSkus = items.length > 0 ? (zoneACount / items.length) * 100 : 0;
  const topSkusContributePct = totalRevenue > 0 ? (zoneARevenue / totalRevenue) * 100 : 0;
  const zoneAAvgRevenue = zoneACount > 0 ? zoneARevenue / zoneACount : 0;

  return {
    items,
    summary: {
      totalRevenue: Math.round(totalRevenue),
      topPctOfSkus: Math.round(topPctOfSkus * 10) / 10,
      topSkusContributePct: Math.round(topSkusContributePct * 10) / 10,
      zoneACount,
      zoneAAvgRevenue: Math.round(zoneAAvgRevenue),
    },
  };
}

function emptyData(): ParetoData {
  return {
    items: [],
    summary: {
      totalRevenue: 0,
      topPctOfSkus: 0,
      topSkusContributePct: 0,
      zoneACount: 0,
      zoneAAvgRevenue: 0,
    },
  };
}
