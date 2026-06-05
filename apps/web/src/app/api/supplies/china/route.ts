import { NextResponse } from 'next/server';
import { replacePlanChinaItems } from '@/entities/supplies';

export const dynamic = 'force-dynamic';

type ChinaInput = { skuId: number; supplierId: number | null; qty: number; priceCny: number | null };

function asItems(v: unknown): ChinaInput[] | null {
  if (!Array.isArray(v)) return null;
  const out: ChinaInput[] = [];
  for (const r of v) {
    if (!r || typeof r !== 'object') return null;
    const o = r as Record<string, unknown>;
    const skuId = Number(o.skuId);
    const supplierId = o.supplierId == null ? null : Number(o.supplierId);
    const qty = Math.max(0, Math.floor(Number(o.qty) || 0));
    const priceCny = o.priceCny == null ? null : Number(o.priceCny);
    if (!Number.isFinite(skuId)) return null;
    out.push({
      skuId,
      supplierId: Number.isFinite(supplierId as number) ? (supplierId as number) : null,
      qty,
      priceCny: Number.isFinite(priceCny as number) ? (priceCny as number) : null,
    });
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
  const ok = await replacePlanChinaItems(planId, items);
  if (!ok) return NextResponse.json({ error: 'save_failed' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
