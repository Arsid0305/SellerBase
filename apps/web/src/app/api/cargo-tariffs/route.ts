import { NextResponse } from 'next/server';
import { createAdminClient } from '@/shared/lib/supabase/admin';

export const dynamic = 'force-dynamic';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function isIsoDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(s).getTime());
}

type Body = {
  cny_rate_rub: number;
  usd_rate_rub?: number | null;
  cny_delivery_per_kg: number;
  effective_from?: string;
  comment?: string;
};

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const b = body as Partial<Body>;

  const cnyRate = Number(b.cny_rate_rub);
  if (!Number.isFinite(cnyRate) || cnyRate <= 0) {
    return NextResponse.json({ error: 'invalid cny_rate_rub' }, { status: 400 });
  }

  const cnyDelivery = Number(b.cny_delivery_per_kg);
  if (!Number.isFinite(cnyDelivery) || cnyDelivery <= 0) {
    return NextResponse.json({ error: 'invalid cny_delivery_per_kg' }, { status: 400 });
  }

  let usdRate: number | null = null;
  if (b.usd_rate_rub != null && String(b.usd_rate_rub).trim() !== '') {
    const v = Number(b.usd_rate_rub);
    if (!Number.isFinite(v) || v <= 0) {
      return NextResponse.json({ error: 'invalid usd_rate_rub' }, { status: 400 });
    }
    usdRate = v;
  }

  const effectiveFrom = b.effective_from && b.effective_from.trim() ? b.effective_from.trim() : todayIso();
  if (!isIsoDate(effectiveFrom)) {
    return NextResponse.json({ error: 'invalid effective_from' }, { status: 400 });
  }

  const comment = typeof b.comment === 'string' && b.comment.trim() ? b.comment.trim() : null;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('cargo_tariffs')
    .insert({
      cny_rate_rub: cnyRate,
      usd_rate_rub: usdRate,
      cny_delivery_per_kg: cnyDelivery,
      effective_from: effectiveFrom,
      comment,
    })
    .select('id, effective_from')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id: data.id, effective_from: data.effective_from });
}
