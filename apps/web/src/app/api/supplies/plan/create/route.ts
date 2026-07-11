import { NextResponse } from 'next/server';
import { createAdminClient } from '@/shared/lib/supabase/admin';
import { requireAuth } from '@/shared/lib/auth/require-auth';

export const dynamic = 'force-dynamic';

type PlanItem = { sku_id: number; qty: number; warehouse_name?: string | null };

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  const b = body as Partial<{ name: string; notes: string; items: PlanItem[] }>;

  const name = b.name?.trim();
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });

  const items = Array.isArray(b.items)
    ? b.items.filter((it): it is PlanItem => it != null && Number.isFinite(Number(it.sku_id)) && Number.isFinite(Number(it.qty)) && Number(it.qty) > 0)
    : [];
  if (items.length === 0) return NextResponse.json({ error: 'no items' }, { status: 400 });

  const supabase = createAdminClient();
  const { data: plan, error: planErr } = await supabase
    .from('supply_plans')
    .insert({ name, status: 'draft', notes: b.notes?.trim() || null })
    .select('id')
    .single();
  if (planErr || !plan) {
    return NextResponse.json({ error: 'plan_insert_failed', details: planErr?.message }, { status: 500 });
  }
  const planId = plan.id as number;

  const rows = items.map((it) => ({
    plan_id: planId,
    sku_id: Number(it.sku_id),
    warehouse_name: it.warehouse_name?.trim() || null,
    qty: Math.round(Number(it.qty)),
  }));
  const { error: itemsErr } = await supabase.from('supply_plan_items').insert(rows);
  if (itemsErr) {
    return NextResponse.json({ error: 'items_insert_failed', details: itemsErr.message, plan_id: planId }, { status: 500 });
  }

  return NextResponse.json({ plan_id: planId, inserted: rows.length });
}
