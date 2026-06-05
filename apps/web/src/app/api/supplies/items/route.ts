import { NextResponse } from 'next/server';
import { replacePlanItems } from '@/entities/supplies';

export const dynamic = 'force-dynamic';

type ItemInput = { skuId: number; warehouseName: string; qty: number };

function asItems(v: unknown): ItemInput[] | null {
  if (!Array.isArray(v)) return null;
  const out: ItemInput[] = [];
  for (const r of v) {
    if (!r || typeof r !== 'object') return null;
    const o = r as Record<string, unknown>;
    const skuId = Number(o.skuId);
    const warehouseName = typeof o.warehouseName === 'string' ? o.warehouseName : '';
    const qty = Math.max(0, Math.floor(Number(o.qty) || 0));
    if (!Number.isFinite(skuId) || !warehouseName) return null;
    out.push({ skuId, warehouseName, qty });
  }
  return out;
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const planId = Number(body.planId);
  if (!Number.isFinite(planId)) return NextResponse.json({ error: 'planId_required' }, { status: 400 });
  const items = asItems(body.items);
  if (!items) return NextResponse.json({ error: 'invalid_items' }, { status: 400 });

  const ok = await replacePlanItems(planId, items);
  if (!ok) return NextResponse.json({ error: 'save_failed' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
