import { createAdminClient } from '@/shared/lib/supabase/admin';
import type { PromoSkuRow, PromoSummary } from './types';

function num(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}
function numOr0(v: unknown): number {
  return num(v) ?? 0;
}

type PromotionDb = {
  promotion_id: number;
  name: string;
  type: string | null;
  start_at: string;
  end_at: string;
};

type MarginDb = {
  promotion_id: number;
  promotion_name: string | null;
  nm_id: number;
  my_article: string | null;
  title: string | null;
  subject_name: string | null;
  cost_to_wb: number | null;
  current_price: number | null;
  plan_price: number | null;
  plan_discount: number | null;
  margin_current_pct: number | null;
  margin_at_promo_pct: number | null;
  user_participate: boolean | null;
};

type CatalogDb = {
  wb_article: number | null;
  barcode: string | null;
  brand: string | null;
};

type StockDb = { nm_id: number | null; quantity: number | null };

type TurnoverDb = { nm_id: number | null; turnover_days: number | null };

type ItemDb = {
  promotion_id: number;
  nm_id: number;
  current_discount: number | null;
  user_participate: boolean | null;
  user_note: string | null;
};

function classifyRecommendation(
  turnoverDays: number | null,
  marginPromoPct: number | null,
): boolean {
  if (turnoverDays == null) return false;
  if (turnoverDays > 90) return true;
  if (turnoverDays >= 60 && marginPromoPct != null && marginPromoPct >= 0.1) return true;
  return false;
}

export async function fetchPromoList(): Promise<PromoSummary[]> {
  const supabase = createAdminClient();

  const { data: promos, error: ePromos } = await supabase
    .from('wb_promotions')
    .select('promotion_id, name, type, start_at, end_at')
    .order('start_at', { ascending: true });

  if (ePromos || !promos) {
    console.error('[fetchPromoList] wb_promotions', ePromos);
    return [];
  }

  const ids = promos.map((p: PromotionDb) => p.promotion_id);
  if (ids.length === 0) return [];

  const [marginResult, turnoverResult] = await Promise.all([
    supabase
      .from('v_promo_margin_calc')
      .select('promotion_id, nm_id, user_participate, margin_at_promo_pct')
      .in('promotion_id', ids),
    supabase.from('v_turnover_by_sku').select('nm_id, turnover_days').range(0, 5000),
  ]);

  const turnoverMap = new Map<number, number | null>();
  for (const t of (turnoverResult.data ?? []) as TurnoverDb[]) {
    if (t.nm_id != null) turnoverMap.set(t.nm_id, num(t.turnover_days));
  }

  type Bucket = {
    sku: number;
    participate: number;
    pending: number;
    turnoverSum: number;
    turnoverN: number;
  };
  const byPromo = new Map<number, Bucket>();
  for (const m of (marginResult.data ?? []) as Pick<
    MarginDb,
    'promotion_id' | 'nm_id' | 'user_participate' | 'margin_at_promo_pct'
  >[]) {
    const b = byPromo.get(m.promotion_id) ?? {
      sku: 0,
      participate: 0,
      pending: 0,
      turnoverSum: 0,
      turnoverN: 0,
    };
    b.sku++;
    if (m.user_participate === true) b.participate++;
    else if (m.user_participate == null) b.pending++;
    const td = turnoverMap.get(m.nm_id);
    if (td != null) {
      b.turnoverSum += td;
      b.turnoverN++;
    }
    byPromo.set(m.promotion_id, b);
  }

  return (promos as PromotionDb[]).map((p) => {
    const b = byPromo.get(p.promotion_id);
    return {
      promotionId: p.promotion_id,
      name: p.name,
      type: p.type,
      startAt: p.start_at,
      endAt: p.end_at,
      skuCount: b?.sku ?? 0,
      participatingCount: b?.participate ?? 0,
      pendingCount: b?.pending ?? 0,
      avgTurnoverDays: b && b.turnoverN > 0 ? Math.round(b.turnoverSum / b.turnoverN) : null,
    };
  });
}

export async function fetchPromoDetail(
  promotionId: number,
): Promise<{ promo: PromoSummary | null; rows: PromoSkuRow[] }> {
  const supabase = createAdminClient();

  const [promoResult, marginResult, itemsResult] = await Promise.all([
    supabase
      .from('wb_promotions')
      .select('promotion_id, name, type, start_at, end_at')
      .eq('promotion_id', promotionId)
      .maybeSingle(),
    supabase
      .from('v_promo_margin_calc')
      .select(
        'promotion_id, promotion_name, nm_id, my_article, title, subject_name, cost_to_wb, current_price, plan_price, plan_discount, margin_current_pct, margin_at_promo_pct, user_participate',
      )
      .eq('promotion_id', promotionId),
    supabase
      .from('wb_promotion_items')
      .select('promotion_id, nm_id, current_discount, user_participate, user_note')
      .eq('promotion_id', promotionId),
  ]);

  if (promoResult.error || !promoResult.data) return { promo: null, rows: [] };
  const promo = promoResult.data as PromotionDb;

  const margins = (marginResult.data ?? []) as MarginDb[];
  const nmIds = [...new Set(margins.map((m) => m.nm_id))];
  if (nmIds.length === 0) {
    return {
      promo: {
        promotionId: promo.promotion_id,
        name: promo.name,
        type: promo.type,
        startAt: promo.start_at,
        endAt: promo.end_at,
        skuCount: 0,
        participatingCount: 0,
        pendingCount: 0,
        avgTurnoverDays: null,
      },
      rows: [],
    };
  }

  const [catalogResult, stocksResult, turnoverResult] = await Promise.all([
    supabase
      .from('sku_catalog')
      .select('wb_article, barcode, brand')
      .in('wb_article', nmIds),
    supabase.from('wb_stocks').select('nm_id, quantity').in('nm_id', nmIds),
    supabase.from('v_turnover_by_sku').select('nm_id, turnover_days').in('nm_id', nmIds),
  ]);

  const catalogMap = new Map<number, CatalogDb>();
  for (const c of (catalogResult.data ?? []) as CatalogDb[]) {
    if (c.wb_article != null) catalogMap.set(c.wb_article, c);
  }
  const stockMap = new Map<number, number>();
  for (const s of (stocksResult.data ?? []) as StockDb[]) {
    if (s.nm_id == null) continue;
    stockMap.set(s.nm_id, (stockMap.get(s.nm_id) ?? 0) + numOr0(s.quantity));
  }
  const turnoverMap = new Map<number, number | null>();
  for (const t of (turnoverResult.data ?? []) as TurnoverDb[]) {
    if (t.nm_id != null) turnoverMap.set(t.nm_id, num(t.turnover_days));
  }
  const itemsMap = new Map<number, ItemDb>();
  for (const i of (itemsResult.data ?? []) as ItemDb[]) {
    itemsMap.set(i.nm_id, i);
  }

  const rows: PromoSkuRow[] = margins.map((m) => {
    const cat = catalogMap.get(m.nm_id);
    const item = itemsMap.get(m.nm_id);
    const turnoverDays = turnoverMap.get(m.nm_id) ?? null;
    const cur = num(m.current_price);
    const pl = num(m.plan_price);
    const cost = num(m.cost_to_wb);
    const marginCurrentPct = num(m.margin_current_pct);
    const marginPromoPct = num(m.margin_at_promo_pct);
    const marginCurrentRub =
      cur != null && marginCurrentPct != null ? Math.round(cur * marginCurrentPct) : null;
    const marginPromoRub =
      pl != null && marginPromoPct != null ? Math.round(pl * marginPromoPct) : null;
    return {
      promotionId: m.promotion_id,
      nmId: m.nm_id,
      myArticle: m.my_article,
      title: m.title,
      brand: cat?.brand ?? null,
      subjectName: m.subject_name,
      barcode: cat?.barcode ?? null,
      stockUnits: stockMap.get(m.nm_id) ?? 0,
      turnoverDays,
      currentPrice: cur,
      currentDiscount: item?.current_discount ?? null,
      planPrice: pl,
      planDiscount: m.plan_discount ?? null,
      marginCurrentPct,
      marginPromoPct,
      marginCurrentRub,
      marginPromoRub,
      recommended: classifyRecommendation(turnoverDays, marginPromoPct),
      userParticipate: item?.user_participate ?? m.user_participate ?? null,
      userNote: item?.user_note ?? null,
    };
    void cost;
  });

  const participate = rows.filter((r) => r.userParticipate === true).length;
  const pending = rows.filter((r) => r.userParticipate == null).length;
  const turnoverNums = rows.map((r) => r.turnoverDays).filter((v): v is number => v != null);
  const avgTurnoverDays =
    turnoverNums.length > 0
      ? Math.round(turnoverNums.reduce((a, b) => a + b, 0) / turnoverNums.length)
      : null;

  return {
    promo: {
      promotionId: promo.promotion_id,
      name: promo.name,
      type: promo.type,
      startAt: promo.start_at,
      endAt: promo.end_at,
      skuCount: rows.length,
      participatingCount: participate,
      pendingCount: pending,
      avgTurnoverDays,
    },
    rows,
  };
}
