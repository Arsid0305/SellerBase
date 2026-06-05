import { NextResponse } from 'next/server';
import { linkSkuScenario, unlinkSkuScenario } from '@/entities/customer';

export const dynamic = 'force-dynamic';

function asId(v: unknown): number | null {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const skuId = asId(body.skuId);
  const scenarioId = asId(body.scenarioId);
  if (skuId == null || scenarioId == null) {
    return NextResponse.json({ error: 'ids_required' }, { status: 400 });
  }
  const fitRaw = body.fitScore;
  const fit =
    typeof fitRaw === 'number'
      ? fitRaw
      : typeof fitRaw === 'string' && fitRaw !== ''
        ? Number(fitRaw)
        : 0.5;
  const ok = await linkSkuScenario(skuId, scenarioId, Number.isFinite(fit) ? fit : 0.5);
  if (!ok) return NextResponse.json({ error: 'link_failed' }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const skuId = asId(body.skuId);
  const scenarioId = asId(body.scenarioId);
  if (skuId == null || scenarioId == null) {
    return NextResponse.json({ error: 'ids_required' }, { status: 400 });
  }
  const ok = await unlinkSkuScenario(skuId, scenarioId);
  if (!ok) return NextResponse.json({ error: 'unlink_failed' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
