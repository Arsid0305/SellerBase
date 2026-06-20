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
  supplies_transport_rub_per_kg?: number | string | null;
  fulfillment_rub_per_unit?: number | string | null;
  delivery_to_wb_rub_per_kg?: number | string | null;
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

  const effectiveFrom = b.effective_from && b.effective_from.trim() ? b.effective_from.trim() : todayIso();
  if (!isIsoDate(effectiveFrom)) {
    return NextResponse.json({ error: 'invalid effective_from' }, { status: 400 });
  }

  const comment = typeof b.comment === 'string' && b.comment.trim() ? b.comment.trim() : null;

  function parseOptionalNumber(v: number | string | null | undefined): number | null | undefined {
    if (v == null || String(v).trim() === '') return undefined;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) return null;
    return n;
  }

  const suppliesTransport = parseOptionalNumber(b.supplies_transport_rub_per_kg);
  const fulfillment = parseOptionalNumber(b.fulfillment_rub_per_unit);
  const deliveryToWb = parseOptionalNumber(b.delivery_to_wb_rub_per_kg);

  if (suppliesTransport === null) {
    return NextResponse.json({ error: 'invalid supplies_transport_rub_per_kg' }, { status: 400 });
  }
  if (fulfillment === null) {
    return NextResponse.json({ error: 'invalid fulfillment_rub_per_unit' }, { status: 400 });
  }
  if (deliveryToWb === null) {
    return NextResponse.json({ error: 'invalid delivery_to_wb_rub_per_kg' }, { status: 400 });
  }

  if (suppliesTransport === undefined && fulfillment === undefined && deliveryToWb === undefined) {
    return NextResponse.json({ error: 'at_least_one_tariff_required' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const ids: { supplies_transport?: number; fulfillment?: number; delivery_to_wb?: number } = {};

  if (suppliesTransport !== undefined) {
    const { data, error } = await supabase
      .from('supplies_transport')
      .insert({ rub_per_kg: suppliesTransport, effective_from: effectiveFrom, comment })
      .select('id')
      .single();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    ids.supplies_transport = data.id;
  }

  if (fulfillment !== undefined) {
    const { data, error } = await supabase
      .from('fulfillment_costs')
      .insert({ rub_per_unit: fulfillment, effective_from: effectiveFrom, comment })
      .select('id')
      .single();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    ids.fulfillment = data.id;
  }

  if (deliveryToWb !== undefined) {
    const { data, error } = await supabase
      .from('delivery_to_wb')
      .insert({ rub_per_kg: deliveryToWb, effective_from: effectiveFrom, comment })
      .select('id')
      .single();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    ids.delivery_to_wb = data.id;
  }

  return NextResponse.json({ ids, effective_from: effectiveFrom });
}
