import { NextResponse } from 'next/server';
import { createPlan, updatePlan, deletePlan, SUPPLY_PLAN_STATUSES, type SupplyPlanStatus } from '@/entities/supplies';

export const dynamic = 'force-dynamic';

function asStatus(v: unknown): SupplyPlanStatus | undefined {
  return typeof v === 'string' && (SUPPLY_PLAN_STATUSES as string[]).includes(v) ? (v as SupplyPlanStatus) : undefined;
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) return NextResponse.json({ error: 'name_required' }, { status: 400 });

  const plan = await createPlan({
    name,
    status: asStatus(body.status),
    notes: typeof body.notes === 'string' ? body.notes : null,
  });
  if (!plan) return NextResponse.json({ error: 'create_failed' }, { status: 500 });
  return NextResponse.json({ plan });
}

export async function PATCH(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const id = typeof body.id === 'number' ? body.id : Number(body.id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: 'id_required' }, { status: 400 });

  const patch: Parameters<typeof updatePlan>[1] = {};
  if (typeof body.name === 'string') patch.name = body.name.trim();
  const s = asStatus(body.status);
  if (s) patch.status = s;
  if (body.notes === null || typeof body.notes === 'string') patch.notes = body.notes as string | null;

  const plan = await updatePlan(id, patch);
  if (!plan) return NextResponse.json({ error: 'update_failed' }, { status: 500 });
  return NextResponse.json({ plan });
}

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const idRaw = url.searchParams.get('id');
  const id = idRaw ? Number(idRaw) : NaN;
  if (!Number.isFinite(id)) return NextResponse.json({ error: 'id_required' }, { status: 400 });
  const ok = await deletePlan(id);
  if (!ok) return NextResponse.json({ error: 'delete_failed' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
