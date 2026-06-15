import { createAdminClient } from '@/shared/lib/supabase/admin';

export type SellerAnalytics = {
  funnel: {
    addToCartPct: number;
    cartToOrderPct: number;
    buyoutPct: number;
    periodDays: number;
  };
  rating: {
    avgRating: number | null;
    skusWithRating: number;
  };
};

function toNumber(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export async function fetchSellerAnalytics(): Promise<SellerAnalytics> {
  const supabase = createAdminClient();

  const [funnelRes, ratingRes] = await Promise.all([
    supabase
      .from('wb_sales_funnel_period')
      .select('open_count, cart_count, order_count, buyout_count, period_start, period_end')
      .range(0, 5000),
    supabase
      .from('sku_catalog')
      .select('rating')
      .eq('is_active', true)
      .not('rating', 'is', null)
      .range(0, 5000),
  ]);

  let opens = 0, carts = 0, orders = 0, buyouts = 0;
  let periodStart: string | null = null, periodEnd: string | null = null;
  for (const r of (funnelRes.data ?? []) as { open_count: number | null; cart_count: number | null; order_count: number | null; buyout_count: number | null; period_start: string | null; period_end: string | null }[]) {
    opens += toNumber(r.open_count);
    carts += toNumber(r.cart_count);
    orders += toNumber(r.order_count);
    buyouts += toNumber(r.buyout_count);
    if (r.period_start && (!periodStart || r.period_start < periodStart)) periodStart = r.period_start;
    if (r.period_end && (!periodEnd || r.period_end > periodEnd)) periodEnd = r.period_end;
  }

  const periodDays = periodStart && periodEnd
    ? Math.round((new Date(periodEnd).getTime() - new Date(periodStart).getTime()) / 86_400_000) + 1
    : 60;

  const ratings = (ratingRes.data ?? []) as { rating: number | null }[];
  const ratingVals = ratings.map((r) => toNumber(r.rating)).filter((v) => v > 0);
  const avgRating = ratingVals.length > 0
    ? Math.round((ratingVals.reduce((a, b) => a + b, 0) / ratingVals.length) * 100) / 100
    : null;

  return {
    funnel: {
      addToCartPct: opens > 0 ? Math.round((carts / opens) * 1000) / 10 : 0,
      cartToOrderPct: carts > 0 ? Math.round((orders / carts) * 1000) / 10 : 0,
      buyoutPct: orders > 0 ? Math.round((buyouts / orders) * 1000) / 10 : 0,
      periodDays,
    },
    rating: {
      avgRating,
      skusWithRating: ratingVals.length,
    },
  };
}
