import { createAdminClient } from '@/shared/lib/supabase/admin';
import type { ConstantPoint } from '@/features/dashboard';

function n(v: unknown): number | null {
  if (v == null) return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
}

export async function fetchConstantsTimeline(): Promise<ConstantPoint[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc('get_constants_timeline');
  if (error || !data) return [];
  return (data as Array<{ dt: string; cny_rate: number | null; delivery_per_kg: number | null; avg_cost_rub: number | null }>).map((r) => ({
    dt: r.dt,
    cny_rate: n(r.cny_rate),
    delivery_per_kg: n(r.delivery_per_kg),
    avg_cost_rub: n(r.avg_cost_rub),
  }));
}
