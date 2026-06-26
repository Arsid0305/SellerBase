import { NextResponse } from 'next/server';
import { createAdminClient } from '@/shared/lib/supabase/admin';
import { requireAuth } from '@/shared/lib/auth/require-auth';

export const dynamic = 'force-dynamic';

type Body = {
  sku_id: number;
  /** NULL → сбросить override (вернуться к общему тарифу). */
  rub_per_unit: number | null;
};

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  const b = body as Partial<Body>;

  const skuId = Number(b.sku_id);
  if (!Number.isFinite(skuId) || skuId <= 0) {
    return NextResponse.json({ error: 'invalid sku_id' }, { status: 400 });
  }

  let rub: number | null = null;
  if (b.rub_per_unit !== null && b.rub_per_unit !== undefined) {
    const v = Number(b.rub_per_unit);
    if (!Number.isFinite(v) || v < 0) {
      return NextResponse.json({ error: 'invalid rub_per_unit' }, { status: 400 });
    }
    rub = v;
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from('sku_catalog')
    .update({ manual_ff_tariff_rub: rub })
    .eq('id', skuId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, sku_id: skuId, rub_per_unit: rub });
}
