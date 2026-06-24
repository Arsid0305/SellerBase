import { NextResponse } from 'next/server';
import { createAdminClient } from '@/shared/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Body = {
  rub_per_unit: number;
  effective_from?: string;
  comment?: string;
};

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  const rub = Number(body.rub_per_unit);
  if (!Number.isFinite(rub) || rub < 0) {
    return NextResponse.json({ error: 'rub_per_unit must be finite >= 0' }, { status: 400 });
  }
  const effective_from = body.effective_from ?? new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(effective_from)) {
    return NextResponse.json({ error: 'effective_from must be YYYY-MM-DD' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from('fulfillment_costs')
    .insert({
      rub_per_unit: rub,
      effective_from,
      comment: body.comment?.trim() || null,
    });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, effective_from });
}
