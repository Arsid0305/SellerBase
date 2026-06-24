import { createAdminClient } from '@/shared/lib/supabase/admin';
import { wbPhotoUrl } from '@/shared/lib/wb-photo';
import { classifyCellLight, classifyRecommendation, type CellLight } from './math';

export type { CellLight };

export type MatrixPromo = {
  promotionId: number;
  name: string;
  type: 'auto' | 'standard';
  startAt: string;
  endAt: string;
};

export type MatrixCell = {
  inPromo: boolean;
  planPrice: number | null;
  planDiscount: number | null;
  marginPromoPct: number | null;
  recommended: boolean;
  light: CellLight;
  userParticipate: boolean | null;
};

export type MatrixSku = {
  nmId: number;
  myArticle: string | null;
  title: string | null;
  brand: string | null;
  subjectName: string | null;
  barcode: string | null;
  photoUrl: string | null;
  stockUnits: number;
  turnoverDays: number | null;
  currentPrice: number | null;
  marginCurrentPct: number | null;
  cells: Record<number, MatrixCell>;
};

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

type CatalogDb = {
  wb_article: number | null;
  my_article: string | null;
  title: string | null;
  brand: string | null;
  subject_name: string | null;
  barcode: string | null;
  photo_url: string | null;
};

type StockDb = { nm_id: number | null; quantity: number | null };
type TurnoverDb = { nm_id: number | null; turnover_days: number | null };
type MarginDb = {
  promotion_id: number;
  nm_id: number;
  current_price: number | null;
  plan_price: number | null;
  plan_discount: number | null;
  margin_current_pct: number | null;
  margin_at_promo_pct: number | null;
  user_participate: boolean | null;
};

export async function fetchPromoMatrix(): Promise<{
  promos: MatrixPromo[];
  skus: MatrixSku[];
}> {
  const supabase = createAdminClient();

  const today = new Date().toISOString().slice(0, 10);
  const horizon = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);

  const { data: promosRaw } = await supabase
    .from('wb_promotions')
    .select('promotion_id, name, type, start_at, end_at')
    .gte('end_at', today)
    .lte('start_at', horizon)
    .order('start_at', { ascending: true });

  const promos: MatrixPromo[] = (promosRaw ?? []).map((p: PromotionDb) => ({
    promotionId: p.promotion_id,
    name: p.name,
    type: p.type === 'auto' ? 'auto' : 'standard',
    startAt: p.start_at,
    endAt: p.end_at,
  }));

  const { data: catalog } = await supabase
    .from('sku_catalog')
    .select('wb_article, my_article, title, brand, subject_name, barcode, photo_url')
    .not('wb_article', 'is', null)
    .order('my_article', { ascending: true });

  const cat = (catalog ?? []) as CatalogDb[];
  const nmIds = cat.map((c) => c.wb_article).filter((v): v is number => v != null);

  if (nmIds.length === 0 || promos.length === 0) {
    return { promos, skus: [] };
  }

  const promoIds = promos.map((p) => p.promotionId);

  const [marginResult, stockResult, turnoverResult] = await Promise.all([
    supabase
      .from('v_promo_margin_calc')
      .select(
        'promotion_id, nm_id, current_price, plan_price, plan_discount, margin_current_pct, margin_at_promo_pct, user_participate',
      )
      .in('promotion_id', promoIds),
    supabase.from('wb_stocks').select('nm_id, quantity').in('nm_id', nmIds),
    supabase.from('v_turnover_by_sku').select('nm_id, turnover_days').in('nm_id', nmIds),
  ]);

  const stockMap = new Map<number, number>();
  for (const s of (stockResult.data ?? []) as StockDb[]) {
    if (s.nm_id == null) continue;
    stockMap.set(s.nm_id, (stockMap.get(s.nm_id) ?? 0) + numOr0(s.quantity));
  }
  const turnoverMap = new Map<number, number | null>();
  for (const t of (turnoverResult.data ?? []) as TurnoverDb[]) {
    if (t.nm_id != null) turnoverMap.set(t.nm_id, num(t.turnover_days));
  }

  const marginIdx = new Map<string, MarginDb>();
  const currentPriceByNm = new Map<number, number>();
  const currentMarginByNm = new Map<number, number>();
  for (const m of (marginResult.data ?? []) as MarginDb[]) {
    marginIdx.set(`${m.promotion_id}:${m.nm_id}`, m);
    const cp = num(m.current_price);
    if (cp != null) currentPriceByNm.set(m.nm_id, cp);
    const mc = num(m.margin_current_pct);
    if (mc != null) currentMarginByNm.set(m.nm_id, mc);
  }

  const skus: MatrixSku[] = cat
    .filter((c): c is CatalogDb & { wb_article: number } => c.wb_article != null)
    .map((c) => {
      const nmId = c.wb_article;
      const turnoverDays = turnoverMap.get(nmId) ?? null;
      const cells: Record<number, MatrixCell> = {};
      for (const p of promos) {
        const m = marginIdx.get(`${p.promotionId}:${nmId}`);
        if (!m) {
          cells[p.promotionId] = {
            inPromo: false,
            planPrice: null,
            planDiscount: null,
            marginPromoPct: null,
            recommended: false,
            light: 'unknown',
            userParticipate: null,
          };
          continue;
        }
        const marginPromoPct = num(m.margin_at_promo_pct);
        cells[p.promotionId] = {
          inPromo: true,
          planPrice: num(m.plan_price),
          planDiscount: m.plan_discount ?? null,
          marginPromoPct,
          recommended: classifyRecommendation(turnoverDays, marginPromoPct),
          light: classifyCellLight(turnoverDays, marginPromoPct),
          userParticipate: m.user_participate ?? null,
        };
      }
      return {
        nmId,
        myArticle: c.my_article,
        title: c.title,
        brand: c.brand,
        subjectName: c.subject_name,
        barcode: c.barcode,
        photoUrl: c.photo_url ?? wbPhotoUrl(nmId),
        stockUnits: stockMap.get(nmId) ?? 0,
        turnoverDays,
        currentPrice: currentPriceByNm.get(nmId) ?? null,
        marginCurrentPct: currentMarginByNm.get(nmId) ?? null,
        cells,
      };
    });

  return { promos, skus };
}
